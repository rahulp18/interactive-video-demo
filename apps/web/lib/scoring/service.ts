import "server-only";
import { db } from "@/prisma/db";
import { buildAssessment, buildChildView } from "./engine";
import { SCORING_RULES_V1, type ScoringRules } from "./rules";
import type { Assessment, AssessmentInput, ChildView, JourneyInput, ModuleInput, RatingInput } from "./types";

/**
 * Reads everything the engine needs for ONE student and returns it as plain data. Computed on every call: child data
 * is never cached (see decisions.md on not caching the user).
 */
export async function loadAssessmentInput(userId: number, asOf: Date = new Date()): Promise<AssessmentInput> {
  const virtueRows = await db.orm.public.Virtue.orderBy((v) => v.position.asc()).all();
  const progress = await db.orm.public.ModuleProgress.where({ userId }).all();
  const moduleIds = progress.map((p) => p.moduleId);

  const moduleRows = moduleIds.length === 0 ? [] : await db.orm.public.Module.where((m) => m.id.in(moduleIds)).all();
  const videoIds = moduleRows.map((m) => m.videoId);
  const interactionRows = videoIds.length === 0 ? [] : await db.orm.public.Interaction.where((i) => i.videoId.in(videoIds)).include("options").all();
  const optionIds = interactionRows.flatMap((i) => i.options.map((o) => o.id));
  const weightRows = optionIds.length === 0 ? [] : await db.orm.public.OptionVirtueWeight.where((w) => w.optionId.in(optionIds)).all();
  const responseRows = await db.orm.public.InteractionResponse.where({ userId }).all();

  const weightsByOption = new Map<number, Record<number, number>>();
  for (const w of weightRows) weightsByOption.set(w.optionId, { ...(weightsByOption.get(w.optionId) ?? {}), [w.virtueId]: w.weight });
  const responseOf = new Map(responseRows.map((r) => [r.interactionId, r]));
  const videoOfModule = new Map(moduleRows.map((m) => [m.id, m.videoId]));

  const modules: ModuleInput[] = progress.map((p) => {
    const videoId = videoOfModule.get(p.moduleId);
    return {
      moduleId: p.moduleId,
      completedAt: p.completedAt,
      interactions: interactionRows
        .filter((i) => i.videoId === videoId)
        .map((i) => {
          const r = responseOf.get(i.id);
          return {
            interactionId: i.id,
            options: i.options.map((o) => ({ optionId: o.id, weights: weightsByOption.get(o.id) ?? {} })),
            response: r ? { responseId: r.id, chosenOptionId: r.selectedOptionId } : null,
          };
        }),
    };
  });

  const ratingRows = await db.orm.public.VirtueRating.where({ studentId: userId }).all();
  const ratings: RatingInput[] = ratingRows.map((r) => ({
    raterKind: r.raterKind as RatingInput["raterKind"],
    virtueId: r.virtueId,
    rating: r.rating,
    mark: r.mark as RatingInput["mark"],
    ratedAt: r.ratedAt,
  }));

  const journeyRows = await db.orm.public.Journey.all();
  const journeyModuleRows = await db.orm.public.JourneyModule.all();
  const journeys: JourneyInput[] = journeyRows.map((j) => ({
    journeyId: j.id,
    title: j.title,
    modules: journeyModuleRows.filter((m) => m.journeyId === j.id).map((m) => ({ moduleId: m.moduleId, level: m.level })),
  }));

  return { asOf, virtues: virtueRows.map((v) => ({ id: v.id, slug: v.slug, name: v.name })), modules, ratings, journeys };
}

/** Full adult-facing assessment (scores, confidence, trend, SWOT) for one student. */
export async function getAssessment(userId: number, rules: ScoringRules = SCORING_RULES_V1, asOf?: Date): Promise<Assessment> {
  return buildAssessment(await loadAssessmentInput(userId, asOf), rules);
}

/** The child-safe projection: superpowers, badges and stars only. */
export async function getChildView(userId: number, rules: ScoringRules = SCORING_RULES_V1, asOf?: Date): Promise<ChildView> {
  return buildChildView(await loadAssessmentInput(userId, asOf), rules);
}
