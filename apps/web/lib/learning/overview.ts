import "server-only";
import { db } from "@/prisma/db";
import { buildAssessment, buildChildView } from "@/lib/scoring/engine";
import { loadAssessmentInput } from "@/lib/scoring/service";
import { SCORING_RULES_V1 } from "@/lib/scoring/rules";
import type { ChildView } from "@/lib/scoring/types";
import { unlockedModuleIds, type JourneyPlacement } from "./rules";
import {
  childBadgeTitle,
  moduleStatus,
  pickUpNext,
  sourceLine,
  treeStage,
  watchedFraction,
  youWillLearn,
  type UpNextCandidate,
} from "./overview-rules";
import type {
  JourneyCard,
  JourneysData,
  ModuleCard,
  ModulePageData,
  NextBadge,
  ProfileData,
  RewardBadge,
  StudentOverview,
  TreeBranch,
  StudentSummary,
  VirtueTreeData,
} from "./overview-types";

// Loaders for the student pages. Each page makes ONE call. They return child-safe types only (see overview-types.ts):
// nothing here is cached, and no score, weakness or reason for a recommendation leaves this file.

type CatalogModule = {
  moduleId: number;
  title: string;
  duration: number;
  virtues: string[];
  primaryVirtueId: number;
  sourceStory: string;
  learningObjective: string;
  followUpActivity: string;
};

type Catalog = {
  virtues: { id: number; slug: string; name: string }[];
  journeys: { id: number; title: string; description: string; focusVirtueId: number | null; displayOrder: number }[];
  placements: JourneyPlacement[];
  modules: Map<number, CatalogModule>;
  progress: Map<number, { positionSeconds: number; completedAt: Date | null; updatedAt: Date }>;
  completed: Set<number>;
  started: Set<number>;
  open: Set<number>;
};

/** Reads the published content plus this student's progress, in one round of parallel queries. */
async function loadCatalog(userId: number): Promise<Catalog> {
  const [virtueRows, journeyRows, journeyModuleRows, moduleRows, secondaryRows, progressRows] = await Promise.all([
    db.orm.public.Virtue.orderBy((v) => v.position.asc()).all(),
    db.orm.public.Journey.orderBy((j) => j.displayOrder.asc()).all(),
    db.orm.public.JourneyModule.all(),
    db.orm.public.Module.where({ status: "PUBLISHED" }).all(),
    db.orm.public.ModuleSecondaryVirtue.all(),
    db.orm.public.ModuleProgress.where({ userId }).all(),
  ]);
  const videoIds = moduleRows.map((m) => m.videoId);
  const videoRows = videoIds.length === 0 ? [] : await db.orm.public.Video.where((v) => v.id.in(videoIds)).all();
  const videoOf = new Map(videoRows.map((v) => [v.id, v]));
  const slugOf = new Map(virtueRows.map((v) => [v.id, v.slug]));

  const modules = new Map<number, CatalogModule>();
  for (const m of moduleRows) {
    const video = videoOf.get(m.videoId);
    if (!video) continue;
    const secondary = secondaryRows
      .filter((s) => s.moduleId === m.id)
      .sort((a, b) => a.position - b.position)
      .map((s) => s.virtueId);
    modules.set(m.id, {
      moduleId: m.id,
      title: video.title,
      duration: video.duration,
      virtues: [m.primaryVirtueId, ...secondary].flatMap((id) => slugOf.get(id) ?? []),
      primaryVirtueId: m.primaryVirtueId,
      sourceStory: m.sourceStory,
      learningObjective: m.learningObjective,
      followUpActivity: m.followUpActivity,
    });
  }

  const placements = journeyModuleRows.map((p) => ({ journeyId: p.journeyId, moduleId: p.moduleId, level: p.level, position: p.position }));
  const progress = new Map(progressRows.map((p) => [p.moduleId, { positionSeconds: p.lastPositionSeconds, completedAt: p.completedAt, updatedAt: p.updatedAt }]));
  const completed = new Set(progressRows.filter((p) => p.completedAt !== null).map((p) => p.moduleId));
  return {
    virtues: virtueRows.map((v) => ({ id: v.id, slug: v.slug, name: v.name })),
    journeys: journeyRows.map((j) => ({ id: j.id, title: j.title, description: j.description, focusVirtueId: j.focusVirtueId, displayOrder: j.displayOrder })),
    placements,
    modules,
    progress,
    completed,
    started: new Set(progressRows.map((p) => p.moduleId)),
    open: unlockedModuleIds(placements, completed),
  };
}

function cardFor(c: Catalog, mod: CatalogModule): ModuleCard {
  const status = moduleStatus(mod.moduleId, c.placements, c.completed, c.started);
  const p = c.progress.get(mod.moduleId);
  return {
    moduleId: mod.moduleId,
    title: mod.title,
    virtues: mod.virtues,
    status,
    watchedFraction: status === "in-progress" ? watchedFraction(p?.positionSeconds ?? 0, mod.duration) : null,
  };
}

function journeyCards(c: Catalog): JourneyCard[] {
  const slugOf = new Map(c.virtues.map((v) => [v.id, v.slug]));
  return c.journeys.map((j) => {
    const placed = c.placements.filter((p) => p.journeyId === j.id && c.modules.has(p.moduleId));
    const levelNumbers = [...new Set(placed.map((p) => p.level))].sort((a, b) => a - b);
    const levels = levelNumbers.map((level) => {
      const inLevel = placed.filter((p) => p.level === level).sort((a, b) => a.position - b.position);
      return {
        level,
        open: inLevel.some((p) => c.open.has(p.moduleId)),
        modules: inLevel.map((p) => cardFor(c, c.modules.get(p.moduleId)!)),
      };
    });
    const all = levels.flatMap((l) => l.modules);
    return {
      journeyId: j.id,
      title: j.title,
      description: j.description,
      focusVirtue: j.focusVirtueId === null ? null : (slugOf.get(j.focusVirtueId) ?? null),
      levels,
      storiesDone: all.filter((m) => m.status === "completed").length,
      storiesTotal: all.length,
    };
  });
}

async function loadStudent(userId: number): Promise<StudentSummary> {
  const user = await db.orm.public.User.where({ id: userId }).first();
  return { name: user?.name ?? "Friend", username: user?.username ?? null, avatar: user?.avatar ?? null };
}

/** Badge titles reworded for children, in the engine's order. */
function rewardBadges(view: ChildView, c: Catalog): RewardBadge[] {
  const stories = new Map([...c.modules.values()].map((m) => [m.moduleId, m.title]));
  const names = new Map(c.virtues.map((v) => [v.id, v.name]));
  return view.badges.map((b) => ({ id: b.id, title: childBadgeTitle(b, stories, names) }));
}

/** One branch per virtue in the FIXED virtue order (never sorted by stars). */
function branchesOf(c: Catalog, view: ChildView): TreeBranch[] {
  const starsOf = new Map(view.stars.byVirtue.map((v) => [v.virtueId, v.stars]));
  return c.virtues.map((v) => ({ slug: v.slug, name: v.name, stars: starsOf.get(v.id) ?? 0 }));
}

/** Journeys page and journey detail. No scoring involved. */
export async function getStudentJourneys(userId: number): Promise<JourneysData> {
  return { journeys: journeyCards(await loadCatalog(userId)) };
}

/** Everything on Home, in one call. */
export async function getStudentOverview(userId: number): Promise<StudentOverview> {
  const [c, student, input] = await Promise.all([loadCatalog(userId), loadStudent(userId), loadAssessmentInput(userId)]);
  const view = buildChildView(input);
  const badges = rewardBadges(view, c);

  // Continue: the most recently active story that is started but not finished.
  const inProgress = [...c.modules.values()]
    .filter((m) => c.started.has(m.moduleId) && !c.completed.has(m.moduleId) && c.open.has(m.moduleId))
    .sort((a, b) => c.progress.get(b.moduleId)!.updatedAt.getTime() - c.progress.get(a.moduleId)!.updatedAt.getTime());
  const current = inProgress[0];

  let upNext: StudentOverview["upNext"] = null;
  if (!current) {
    // The engine may steer the choice (FR-5.15); only the chosen module leaves this function, never the reason.
    const focus = buildAssessment(input, SCORING_RULES_V1).nextStepVirtueIds;
    const journeyOrder = new Map(c.journeys.map((j, i) => [j.id, i]));
    const candidates: UpNextCandidate[] = [];
    for (const p of c.placements) {
      const mod = c.modules.get(p.moduleId);
      if (!mod || c.completed.has(p.moduleId) || c.started.has(p.moduleId) || !c.open.has(p.moduleId)) continue;
      candidates.push({ moduleId: p.moduleId, primaryVirtueId: mod.primaryVirtueId, journeyOrder: journeyOrder.get(p.journeyId) ?? 0, level: p.level, position: p.position });
    }
    const id = pickUpNext(candidates, focus);
    const mod = id === null ? undefined : c.modules.get(id);
    if (mod) upNext = { moduleId: mod.moduleId, title: mod.title, virtues: mod.virtues };
  }

  return {
    student,
    journeys: journeyCards(c),
    continue: current
      ? { moduleId: current.moduleId, title: current.title, virtues: current.virtues, watchedFraction: watchedFraction(c.progress.get(current.moduleId)!.positionSeconds, current.duration) }
      : null,
    upNext,
    storiesFinished: view.modulesCompleted,
    totalStars: view.stars.total,
    badgeCount: badges.length,
    newestBadge: newestBadge(badges, c),
    treeStage: treeStage(view.stars.total),
    branches: branchesOf(c, view),
  };
}

/** The badge earned most recently: the latest finished story's badge, falling back to the last one listed. */
function newestBadge(badges: RewardBadge[], c: Catalog): RewardBadge | null {
  if (badges.length === 0) return null;
  const latest = [...c.progress.entries()]
    .filter(([, p]) => p.completedAt !== null)
    .sort((a, b) => b[1].completedAt!.getTime() - a[1].completedAt!.getTime())[0];
  return badges.find((b) => latest && b.id === `module:${latest[0]}`) ?? badges[badges.length - 1];
}

/** One module's page. A locked module returns only what is needed to say how to unlock it. */
export async function getStudentModulePage(userId: number, moduleId: number): Promise<ModulePageData> {
  const c = await loadCatalog(userId);
  const mod = c.modules.get(moduleId);
  if (!mod) return { status: "missing" };

  const journeys = journeyCards(c);
  const home = journeys.find((j) => j.levels.some((l) => l.modules.some((m) => m.moduleId === moduleId)));
  const journey = home ? { journeyId: home.journeyId, title: home.title } : null;
  const card = cardFor(c, mod);

  if (card.status === "locked") {
    const level = home?.levels.find((l) => l.modules.some((m) => m.moduleId === moduleId))?.level ?? 2;
    return {
      status: "locked",
      moduleId,
      title: mod.title,
      virtues: mod.virtues,
      unlockHint: `Finish the stories in Level ${Math.max(1, level - 1)}${home ? ` of ${home.title}` : ""} to open this one.`,
      journey,
    };
  }
  return {
    status: "ok",
    moduleId,
    title: mod.title,
    sourceLine: sourceLine(mod.sourceStory),
    virtues: mod.virtues,
    youWillLearn: youWillLearn(mod.learningObjective),
    moduleStatus: card.status,
    watchedFraction: card.watchedFraction,
    followUpActivity: card.status === "completed" ? mod.followUpActivity : null,
    journey,
  };
}

/** My Virtue Tree. Branches always come in the fixed virtue order. */
export async function getVirtueTree(userId: number): Promise<VirtueTreeData> {
  const [c, input] = await Promise.all([loadCatalog(userId), loadAssessmentInput(userId)]);
  const view = buildChildView(input);

  // Silhouettes of what comes next: the first unfinished level of each journey the child can open.
  const nextBadges: NextBadge[] = [];
  for (const j of journeyCards(c)) {
    const next = j.levels.find((l) => l.open && l.modules.some((m) => m.status !== "completed"));
    if (next) nextBadges.push({ id: `next:${j.journeyId}:${next.level}`, title: `${j.title}, level ${next.level} done!` });
  }

  return {
    stage: treeStage(view.stars.total),
    totalStars: view.stars.total,
    branches: branchesOf(c, view),
    superpowers: view.superpowers.map((s) => ({ slug: c.virtues.find((v) => v.id === s.virtueId)?.slug ?? "", name: s.name })).filter((s) => s.slug),
    badges: rewardBadges(view, c),
    nextBadges: nextBadges.slice(0, 3),
  };
}

export async function getStudentProfile(userId: number): Promise<ProfileData> {
  const [student, input] = await Promise.all([loadStudent(userId), loadAssessmentInput(userId)]);
  const view = buildChildView(input);
  return { ...student, storiesFinished: view.modulesCompleted, totalStars: view.stars.total, badgeCount: view.badges.length };
}
