import "server-only";
import { db } from "@/prisma/db";
import { AuthError } from "@/lib/auth/errors";
import { normalizeAnswer, ANSWER_TEXT_MAX } from "@/lib/interactions/model";
import { buildChildView } from "@/lib/scoring/engine";
import { loadAssessmentInput } from "@/lib/scoring/service";
import { CLIPS } from "@/scripts/demo/content/clips";
import { toPublicInteractions } from "@/lib/watch/service";
import { recordResponse, retryOnUniqueViolation, type StoredAnswer } from "./record";
import { isModuleUnlocked, nextModuleAfter, resumePosition, type JourneyPlacement } from "./rules";
import type { ModuleRewards, PlayerLookup, SaveAnswerReply } from "./types";

const notFound = () => new AuthError("NOT_FOUND", "Story not found.");
const locked = () => new AuthError("FORBIDDEN", "This story is not open yet. Finish the stories before it first.");

const MAX_RESPONSE_MS = 60 * 60 * 1000;
const MAX_REPLAYS = 1000;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

type Opened = {
  mod: { id: number; videoId: number; followUpActivity: string; primaryVirtueId: number };
  video: { id: number; title: string; fileUrl: string; duration: number };
  placements: JourneyPlacement[];
  completedIds: Set<number>;
  unlocked: boolean;
};

/** Loads a PUBLISHED module with everything needed to decide whether this student may open it. */
async function openModule(userId: number, moduleId: number): Promise<Opened | null> {
  const mod = await db.orm.public.Module.where({ id: moduleId, status: "PUBLISHED" }).first();
  if (!mod) return null;
  const video = await db.orm.public.Video.where({ id: mod.videoId }).first();
  if (!video) return null;
  const [journeyModules, progress] = await Promise.all([
    db.orm.public.JourneyModule.all(),
    db.orm.public.ModuleProgress.where({ userId }).all(),
  ]);
  const placements = journeyModules.map((m) => ({ journeyId: m.journeyId, moduleId: m.moduleId, level: m.level, position: m.position }));
  const completedIds = new Set(progress.filter((p) => p.completedAt !== null).map((p) => p.moduleId));
  return { mod, video, placements, completedIds, unlocked: isModuleUnlocked(moduleId, placements, completedIds) };
}

/** Throws NOT_FOUND (missing or unpublished) or FORBIDDEN (locked). Used by every student learning endpoint. */
async function requireOpenModule(userId: number, moduleId: number): Promise<Opened> {
  const opened = await openModule(userId, moduleId);
  if (!opened) throw notFound();
  if (!opened.unlocked) throw locked();
  return opened;
}

const creditFor = (fileUrl: string) => Object.values(CLIPS).find((c) => c.url === fileUrl)?.attribution ?? null;

/** For the player page: the playable module, a friendly locked state, or missing. */
export async function loadPlayerModule(userId: number, moduleId: number): Promise<PlayerLookup> {
  const opened = await openModule(userId, moduleId);
  if (!opened) return { status: "missing" };
  if (!opened.unlocked) return { status: "locked", title: opened.video.title };
  const { mod, video, completedIds } = opened;

  const rows = await db.orm.public.Interaction.where({ videoId: video.id }).include("options").all();
  const interactions = toPublicInteractions(rows);
  const mine = interactions.length === 0 ? [] : await db.orm.public.InteractionResponse.where({ userId }).where((r) => r.interactionId.in(interactions.map((i) => i.id))).all();
  const answeredIds = mine.map((r) => r.interactionId);
  const progress = await db.orm.public.ModuleProgress.where({ userId, moduleId }).first();
  const completed = completedIds.has(moduleId);

  const [secondary, virtues] = await Promise.all([db.orm.public.ModuleSecondaryVirtue.where({ moduleId }).all(), db.orm.public.Virtue.all()]);
  const nameOf = new Map(virtues.map((v) => [v.id, v.name]));
  const virtueNames = [mod.primaryVirtueId, ...secondary.sort((a, b) => a.position - b.position).map((s) => s.virtueId)].flatMap((id) => nameOf.get(id) ?? []);

  return {
    status: "ok",
    data: {
      moduleId,
      title: video.title,
      videoUrl: video.fileUrl,
      duration: video.duration,
      credit: creditFor(video.fileUrl),
      virtues: virtueNames,
      interactions,
      answeredIds,
      resumeSeconds: resumePosition(progress?.lastPositionSeconds ?? 0, video.duration, interactions, new Set(answeredIds), completed),
      completed,
    },
  };
}

function invalid(fields: Record<string, string>): never {
  throw new AuthError("VALIDATION_ERROR", "Invalid request.", fields);
}

const asInt = (value: unknown, max: number, field: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) invalid({ [field]: "Must be a non-negative number." });
  return Math.min(Math.round(value), max);
};

/** A playback position in seconds, kept to 0.1 s and clamped to the video's length. */
const asSeconds = (value: unknown, duration: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) invalid({ positionSeconds: "Must be a non-negative number." });
  return Math.min(Math.round(value * 10) / 10, duration);
};

/**
 * Saves one answer and the module progress in a single transaction. The checks, in order: the caller is a student
 * (route), the module is published and open, the interaction belongs to this module's video, a required question is
 * not skipped. Replies fast and neutrally: only a QUIZ says whether the guess matched; nothing reveals weights or how
 * "good" a SURVEY choice was.
 */
export async function saveAnswer(userId: number, moduleId: number, body: unknown): Promise<SaveAnswerReply> {
  const { video } = await requireOpenModule(userId, moduleId);
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  const interactionId = typeof raw.interactionId === "number" && Number.isInteger(raw.interactionId) ? raw.interactionId : invalid({ interactionId: "Required." });
  const requestId = typeof raw.idempotencyKey === "string" && KEY_PATTERN.test(raw.idempotencyKey) ? raw.idempotencyKey : invalid({ idempotencyKey: "Required." });
  const responseTimeMs = asInt(raw.responseTimeMs, MAX_RESPONSE_MS, "responseTimeMs");
  const replayCount = asInt(raw.replayCount, MAX_REPLAYS, "replayCount");
  const positionSeconds = asSeconds(raw.positionSeconds, video.duration);

  const interaction = await db.orm.public.Interaction.where({ id: interactionId, videoId: video.id }).include("options").first();
  if (!interaction) throw notFound(); // also covers an interaction of another module

  let answer: StoredAnswer;
  let reply: Omit<SaveAnswerReply, "next">;
  if (raw.skip === true) {
    if (!interaction.isSkippable) invalid({ skip: "This question needs an answer." });
    answer = null;
    reply = { type: "SKIPPED" };
  } else if (interaction.answerType === "TEXT") {
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text || text.length > ANSWER_TEXT_MAX) invalid({ text: `Enter an answer of up to ${ANSWER_TEXT_MAX} characters.` });
    answer = { textAnswer: text };
    reply = interaction.type === "QUIZ" ? { type: "QUIZ", matched: !!interaction.correctAnswer && normalizeAnswer(text) === normalizeAnswer(interaction.correctAnswer) } : { type: "SURVEY" };
  } else {
    const option = typeof raw.optionId === "number" ? interaction.options.find((o) => o.id === raw.optionId) : undefined;
    if (!option) invalid({ optionId: "Choose one of the options." });
    answer = { selectedOptionId: option.id };
    reply = interaction.type === "QUIZ" ? { type: "QUIZ", matched: option.isCorrect } : { type: "SURVEY" };
  }

  await retryOnUniqueViolation(() =>
    db.transaction(async (tx) => {
      const saved = await recordResponse(tx, { userId, interactionId, answer, capture: { responseTimeMs, replayCount, requestId } });
      if (saved.duplicate) return; // a retry of an answer that is already stored changes nothing
      const progress = await tx.orm.public.ModuleProgress.where({ userId, moduleId }).first();
      if (progress) await tx.orm.public.ModuleProgress.where({ userId, moduleId }).updateAll({ lastPositionSeconds: positionSeconds });
      else await tx.orm.public.ModuleProgress.create({ userId, moduleId, lastPositionSeconds: positionSeconds });
    }),
  );

  return { ...reply, next: { kind: "continue" } };
}

/** Throttled position save. Never touches `completedAt`. */
export async function saveProgress(userId: number, moduleId: number, body: unknown): Promise<void> {
  const { video } = await requireOpenModule(userId, moduleId);
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const positionSeconds = asSeconds(raw.positionSeconds, video.duration);
  await retryOnUniqueViolation(async () => {
    const existing = await db.orm.public.ModuleProgress.where({ userId, moduleId }).first();
    if (existing) await db.orm.public.ModuleProgress.where({ userId, moduleId }).updateAll({ lastPositionSeconds: positionSeconds });
    else await db.orm.public.ModuleProgress.create({ userId, moduleId, lastPositionSeconds: positionSeconds });
  });
}

/**
 * Marks the module complete once every required question has an answer, and returns the rewards. `completedAt` is set
 * only the first time: repeating the call (or finishing a re-watch) never moves it. The rewards are the difference
 * between the child view with and without this module counted, so they are the same on every repeat and are read from
 * the scoring engine, not stored.
 */
export async function completeModule(userId: number, moduleId: number): Promise<ModuleRewards> {
  const { mod, video, placements } = await requireOpenModule(userId, moduleId);

  const required = await db.orm.public.Interaction.where({ videoId: video.id, isSkippable: false }).all();
  const answered = required.length === 0 ? [] : await db.orm.public.InteractionResponse.where({ userId }).where((r) => r.interactionId.in(required.map((i) => i.id))).all();
  const answeredIds = new Set(answered.filter((r) => !r.isSkipped).map((r) => r.interactionId));
  if (required.some((i) => !answeredIds.has(i.id))) throw new AuthError("CONFLICT", "Answer every question to finish this story.");

  await retryOnUniqueViolation(async () => {
    const progress = await db.orm.public.ModuleProgress.where({ userId, moduleId }).first();
    if (!progress) await db.orm.public.ModuleProgress.create({ userId, moduleId, lastPositionSeconds: video.duration, completedAt: new Date() });
    else if (progress.completedAt === null) {
      await db.orm.public.ModuleProgress.where({ userId, moduleId }).where((p) => p.completedAt.isNull()).updateAll({ completedAt: new Date() });
    }
  });

  const input = await loadAssessmentInput(userId);
  const without = { ...input, modules: input.modules.map((m) => (m.moduleId === moduleId ? { ...m, completedAt: null } : m)) };
  const before = buildChildView(without);
  const after = buildChildView(input);

  const hadBadge = new Set(before.badges.map((b) => b.id));
  const nameOf = new Map(input.virtues.map((v) => [v.id, v.name]));
  const starsBefore = new Map(before.stars.byVirtue.map((v) => [v.virtueId, v.stars]));
  const grew = after.stars.byVirtue.filter((v) => v.stars > (starsBefore.get(v.virtueId) ?? 0)).flatMap((v) => nameOf.get(v.virtueId) ?? []);

  const completedIds = new Set(input.modules.filter((m) => m.completedAt !== null).map((m) => m.moduleId));
  const journeys = await db.orm.public.Journey.orderBy((j) => j.displayOrder.asc()).all();
  const order = journeys.map((j) => j.id);
  const next = nextModuleAfter(moduleId, placements, completedIds, order);
  const nextModule = next ? await moduleTitle(next.moduleId) : null;
  const here = order.find((id) => placements.some((p) => p.journeyId === id && p.moduleId === moduleId));
  const journeyRow = journeys.find((j) => j.id === (next?.journeyId ?? here));

  return {
    stars: after.stars.total - before.stars.total,
    totalStars: after.stars.total,
    badges: after.badges.filter((b) => !hadBadge.has(b.id)).map((b) => ({ id: b.id, title: b.title })),
    grew,
    followUpActivity: mod.followUpActivity,
    nextModule: next && nextModule ? { moduleId: next.moduleId, title: nextModule } : null,
    journey: journeyRow ? { journeyId: journeyRow.id, title: journeyRow.title } : null,
  };
}

async function moduleTitle(moduleId: number): Promise<string | null> {
  const mod = await db.orm.public.Module.where({ id: moduleId }).first();
  if (!mod) return null;
  return (await db.orm.public.Video.where({ id: mod.videoId }).first())?.title ?? null;
}
