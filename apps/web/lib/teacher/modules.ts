import "server-only";
import { db } from "@/prisma/db";
import { AuthError } from "@/lib/auth/errors";
import { isUniqueViolation } from "@/lib/auth/service";
import { getVideo } from "@/lib/videos/service";
import { virtueDisplay, type VirtueSlug } from "@/lib/virtues/display";
import { moduleReadiness, validateModuleDetails, type AgeBand, type ModuleDetailsInput, type ModuleStatus, type ReadinessItem } from "./modules-model";

// Teacher-side story modules. A teacher owns a module through its video (Video.uploaderId); someone else's module is
// indistinguishable from a missing one (NOT_FOUND), the same rule as videos. Nothing is cached.

export type VirtueOption = { id: number; slug: VirtueSlug; name: string };
export type Placement = { journeyId: number; journeyTitle: string; level: number };

export type TeacherModuleRow = {
  id: number;
  videoId: number;
  title: string;
  duration: number;
  sourceStory: string;
  primary: VirtueOption;
  secondary: VirtueOption[];
  ageBand: AgeBand;
  status: ModuleStatus;
  questionCount: number;
  weightedQuestionCount: number;
  textQuestionCount: number;
  promptCount: number;
  placements: Placement[];
  startedCount: number;
  completedCount: number;
  updatedAt: string;
};

export type TeacherModuleDetail = TeacherModuleRow & {
  learningObjective: string;
  discussionPrompts: string[];
  followUpActivity: string;
  readiness: ReadinessItem[];
};

const validationError = (errors: Record<string, string>) => new AuthError("VALIDATION_ERROR", "Invalid request.", errors);

export async function listVirtues(): Promise<VirtueOption[]> {
  const rows = await db.orm.public.Virtue.orderBy((v) => v.position.asc()).all();
  return rows.map((v) => ({ id: v.id, slug: virtueDisplay(v.slug).slug, name: v.name }));
}

/** Loads every module of the given videos with the counts the list and detail pages show, in a few batched queries. */
async function loadRows(videos: { id: number; title: string; duration: number }[]): Promise<(TeacherModuleRow & { raw: ModuleRaw })[]> {
  const videoIds = videos.map((v) => v.id);
  if (videoIds.length === 0) return [];
  const modules = await db.orm.public.Module.where((m) => m.videoId.in(videoIds)).all();
  if (modules.length === 0) return [];
  const moduleIds = modules.map((m) => m.id);

  const [virtues, secondaries, placements, journeys, interactions, progress] = await Promise.all([
    listVirtues(),
    db.orm.public.ModuleSecondaryVirtue.where((s) => s.moduleId.in(moduleIds)).all(),
    db.orm.public.JourneyModule.where((p) => p.moduleId.in(moduleIds)).all(),
    db.orm.public.Journey.all(),
    db.orm.public.Interaction.where((i) => i.videoId.in(videoIds)).include("options").all(),
    db.orm.public.ModuleProgress.where((p) => p.moduleId.in(moduleIds)).all(),
  ]);
  const optionIds = interactions.flatMap((i) => i.options.map((o) => o.id));
  const weights = optionIds.length === 0 ? [] : await db.orm.public.OptionVirtueWeight.where((w) => w.optionId.in(optionIds)).all();
  const weightedOptions = new Set(weights.map((w) => w.optionId));

  const virtueOf = new Map(virtues.map((v) => [v.id, v]));
  const journeyTitle = new Map(journeys.map((j) => [j.id, j.title]));
  const videoOf = new Map(videos.map((v) => [v.id, v]));

  return modules
    .map((m) => {
      const video = videoOf.get(m.videoId)!;
      const qs = interactions.filter((i) => i.videoId === m.videoId);
      const prog = progress.filter((p) => p.moduleId === m.id);
      return {
        id: m.id,
        videoId: m.videoId,
        title: video.title,
        duration: video.duration,
        sourceStory: m.sourceStory,
        primary: virtueOf.get(m.primaryVirtueId)!,
        secondary: secondaries
          .filter((s) => s.moduleId === m.id)
          .sort((a, b) => a.position - b.position)
          .flatMap((s) => virtueOf.get(s.virtueId) ?? []),
        ageBand: m.ageBand as AgeBand,
        status: m.status as ModuleStatus,
        questionCount: qs.length,
        weightedQuestionCount: qs.filter((i) => i.options.some((o) => weightedOptions.has(o.id))).length,
        textQuestionCount: qs.filter((i) => i.answerType === "TEXT").length,
        promptCount: m.discussionPrompts.length,
        placements: placements
          .filter((p) => p.moduleId === m.id)
          .map((p) => ({ journeyId: p.journeyId, journeyTitle: journeyTitle.get(p.journeyId) ?? "Journey", level: p.level })),
        startedCount: prog.length,
        completedCount: prog.filter((p) => p.completedAt !== null).length,
        updatedAt: m.updatedAt.toISOString(),
        raw: m,
      };
    })
    .sort((a, b) => a.primary.id - b.primary.id || a.title.localeCompare(b.title));
}
type ModuleRaw = { learningObjective: string; discussionPrompts: readonly string[]; followUpActivity: string };

const strip = <T extends { raw: unknown }>(row: T): Omit<T, "raw"> => {
  const { raw, ...rest } = row;
  void raw;
  return rest;
};

/** The caller's story modules, in fixed virtue order. */
export async function listTeacherModules(teacherId: number): Promise<TeacherModuleRow[]> {
  const videos = await db.orm.public.Video.where({ uploaderId: teacherId }).all();
  return (await loadRows(videos)).map(strip);
}

/** One module the caller owns, with readiness. NOT_FOUND for a missing or foreign module. */
export async function getTeacherModule(teacherId: number, moduleId: number): Promise<TeacherModuleDetail> {
  const mod = await db.orm.public.Module.where({ id: moduleId }).first();
  if (!mod) throw new AuthError("NOT_FOUND", "Module not found.");
  const video = await db.orm.public.Video.where({ id: mod.videoId, uploaderId: teacherId }).first();
  if (!video) throw new AuthError("NOT_FOUND", "Module not found.");
  const [row] = await loadRows([video]);
  return {
    ...strip(row),
    learningObjective: row.raw.learningObjective,
    discussionPrompts: [...row.raw.discussionPrompts],
    followUpActivity: row.raw.followUpActivity,
    readiness: moduleReadiness({
      questionCount: row.questionCount,
      textQuestionCount: row.textQuestionCount,
      weightedQuestionCount: row.weightedQuestionCount,
      promptCount: row.promptCount,
      inJourney: row.placements.length > 0,
    }),
  };
}

/** The caller's videos that are not story modules yet (candidates for "New story module"). */
export async function listConvertibleVideos(teacherId: number): Promise<{ id: number; title: string; duration: number }[]> {
  const videos = await db.orm.public.Video.where({ uploaderId: teacherId })
    .orderBy([(v) => v.createdAt.desc(), (v) => v.id.desc()])
    .all();
  if (videos.length === 0) return [];
  const taken = new Set((await db.orm.public.Module.where((m) => m.videoId.in(videos.map((v) => v.id))).all()).map((m) => m.videoId));
  return videos.filter((v) => !taken.has(v.id)).map((v) => ({ id: v.id, title: v.title, duration: v.duration }));
}

async function parseDetails(body: unknown): Promise<ModuleDetailsInput> {
  const virtues = await listVirtues();
  const parsed = validateModuleDetails(body, new Set(virtues.map((v) => v.id)));
  if (parsed.errors) throw validationError(parsed.errors);
  return parsed.value;
}

/** Turns one of the caller's videos into a DRAFT story module. Returns the new module id. */
export async function createModule(teacherId: number, videoId: number, body: unknown): Promise<number> {
  await getVideo(teacherId, videoId);
  const input = await parseDetails(body);
  if (await db.orm.public.Module.where({ videoId }).first()) throw new AuthError("CONFLICT", "This video is already a story module.");
  try {
    const id = await db.transaction(async (tx) => {
      const created = await tx.orm.public.Module.create({
        videoId,
        sourceStory: input.sourceStory,
        primaryVirtueId: input.primaryVirtueId,
        ageBand: input.ageBand,
        learningObjective: input.learningObjective,
        discussionPrompts: input.discussionPrompts,
        followUpActivity: input.followUpActivity,
        status: "DRAFT",
      });
      if (input.secondaryVirtueIds.length > 0) {
        await tx.orm.public.ModuleSecondaryVirtue.createAll(
          input.secondaryVirtueIds.map((virtueId, i) => ({ moduleId: created.id, virtueId, primaryVirtueId: input.primaryVirtueId, position: i + 1 })),
        );
      }
      return created.id;
    });
    return id;
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("CONFLICT", "This video is already a story module.");
    throw error;
  }
}

/**
 * Replaces a module's details. Secondary virtues are removed BEFORE the primary changes: their mirrored primaryVirtueId
 * cascades on update, and a CHECK forbids a secondary equal to the primary, so the new primary must never meet an old row.
 */
export async function updateModuleDetails(teacherId: number, moduleId: number, body: unknown): Promise<void> {
  await getTeacherModule(teacherId, moduleId);
  const input = await parseDetails(body);
  await db.transaction(async (tx) => {
    await tx.orm.public.ModuleSecondaryVirtue.where((s) => s.moduleId.eq(moduleId)).deleteAll();
    await tx.orm.public.Module.where({ id: moduleId }).updateAll({
      sourceStory: input.sourceStory,
      primaryVirtueId: input.primaryVirtueId,
      ageBand: input.ageBand,
      learningObjective: input.learningObjective,
      discussionPrompts: input.discussionPrompts,
      followUpActivity: input.followUpActivity,
    });
    if (input.secondaryVirtueIds.length > 0) {
      await tx.orm.public.ModuleSecondaryVirtue.createAll(
        input.secondaryVirtueIds.map((virtueId, i) => ({ moduleId, virtueId, primaryVirtueId: input.primaryVirtueId, position: i + 1 })),
      );
    }
  });
}

/** Publishing requires every `required` readiness item; unpublishing is always allowed (the page warns about journeys). */
export async function setModuleStatus(teacherId: number, moduleId: number, status: ModuleStatus): Promise<void> {
  const mod = await getTeacherModule(teacherId, moduleId);
  if (status === "PUBLISHED") {
    const missing = mod.readiness.filter((r) => r.required && !r.ok);
    if (missing.length > 0) throw new AuthError("CONFLICT", `Not ready to publish: ${missing.map((m) => m.label.toLowerCase()).join("; ")}.`);
  }
  if (mod.status === status) return;
  await db.orm.public.Module.where({ id: moduleId }).updateAll({ status });
}

// ---------------------------------------------------------------------------------------------- journeys (read-only)

export type JourneyModuleCell = {
  moduleId: number;
  title: string;
  primary: VirtueOption;
  status: ModuleStatus;
  /** The signed-in teacher owns it, so the page may link to its editor. */
  mine: boolean;
  startedCount: number;
  completedCount: number;
};
export type JourneyOverview = {
  id: number;
  title: string;
  description: string;
  focus: VirtueOption | null;
  levels: { level: number; modules: JourneyModuleCell[] }[];
  learnersStarted: number;
  learnersFinished: number;
  /** A level that is not first and follows a level with an unpublished module: children cannot reach it. */
  blockedLevels: number[];
};

/**
 * Journeys have no owner (they are platform content), so every teacher sees all of them, read-only. Counts are distinct
 * learners with progress in the journey, and learners who completed every published module in it.
 */
export async function listJourneysOverview(teacherId: number): Promise<JourneyOverview[]> {
  const [journeys, placements, virtues] = await Promise.all([
    db.orm.public.Journey.orderBy((j) => j.displayOrder.asc()).all(),
    db.orm.public.JourneyModule.all(),
    listVirtues(),
  ]);
  const moduleIds = [...new Set(placements.map((p) => p.moduleId))];
  const modules = moduleIds.length === 0 ? [] : await db.orm.public.Module.where((m) => m.id.in(moduleIds)).all();
  const videoIds = modules.map((m) => m.videoId);
  const [videos, progress] = await Promise.all([
    videoIds.length === 0 ? Promise.resolve([]) : db.orm.public.Video.where((v) => v.id.in(videoIds)).all(),
    moduleIds.length === 0 ? Promise.resolve([]) : db.orm.public.ModuleProgress.where((p) => p.moduleId.in(moduleIds)).all(),
  ]);
  const virtueOf = new Map(virtues.map((v) => [v.id, v]));
  const videoOf = new Map(videos.map((v) => [v.id, v]));
  const moduleOf = new Map(modules.map((m) => [m.id, m]));

  return journeys.map((j) => {
    const mine = placements.filter((p) => p.journeyId === j.id).sort((a, b) => a.level - b.level || a.position - b.position);
    const levels = [...new Set(mine.map((p) => p.level))].map((level) => ({
      level,
      modules: mine
        .filter((p) => p.level === level)
        .flatMap((p) => {
          const m = moduleOf.get(p.moduleId);
          const v = m && videoOf.get(m.videoId);
          if (!m || !v) return [];
          const prog = progress.filter((r) => r.moduleId === m.id);
          return [{
            moduleId: m.id,
            title: v.title,
            primary: virtueOf.get(m.primaryVirtueId)!,
            status: m.status as ModuleStatus,
            mine: v.uploaderId === teacherId,
            startedCount: prog.length,
            completedCount: prog.filter((r) => r.completedAt !== null).length,
          }];
        }),
    }));
    const ids = new Set(mine.map((p) => p.moduleId));
    const inJourney = progress.filter((p) => ids.has(p.moduleId));
    const learners = new Set(inJourney.map((p) => p.userId));
    const published = mine.filter((p) => moduleOf.get(p.moduleId)?.status === "PUBLISHED").map((p) => p.moduleId);
    const finished = [...learners].filter(
      (u) => published.length > 0 && published.every((id) => inJourney.some((p) => p.userId === u && p.moduleId === id && p.completedAt !== null)),
    );
    const blockedLevels: number[] = [];
    let blocked = false;
    for (const l of levels) {
      if (blocked) blockedLevels.push(l.level);
      if (l.modules.some((m) => m.status !== "PUBLISHED")) blocked = true;
    }
    return {
      id: j.id,
      title: j.title,
      description: j.description,
      focus: j.focusVirtueId === null ? null : (virtueOf.get(j.focusVirtueId) ?? null),
      levels,
      learnersStarted: learners.size,
      learnersFinished: finished.length,
      blockedLevels,
    };
  });
}
