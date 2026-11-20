import "server-only";
import { db } from "@/prisma/db";
import type { VirtueSlug } from "@/lib/virtues/display";
import { buildAssessment } from "@/lib/scoring/engine";
import { SCORING_RULES_V1, type ScoringRules } from "@/lib/scoring/rules";
import { loadAssessmentInput } from "@/lib/scoring/service";
import type { SwotItem } from "@/lib/scoring/types";
import {
  EXPERTS_BY_VIRTUE,
  dataSentence,
  describeParentChange,
  isPersistentWeakness,
  parentReason,
  ratingSetDays,
  ratingsBeforeLatestSet,
  strengthsSentence,
} from "./report-rules";
import type { ExpertSuggestion, ParentInputRow, ParentReport, ReportEvidence, ReportStep, ReportSwotItem } from "./types";

// Loader for the parent preview. Adult-facing: it returns scores. Nothing is cached, and it is only ever called for the
// signed-in student's OWN id after the parental gate has been confirmed (see app/(app)/student/parent/page.tsx).

/**
 * Resolves response ids to what the child actually answered. Ownership is checked in the query itself (`userId`), so an
 * id that belongs to another student is silently dropped; ids are never trusted.
 */
export async function resolveEvidence(userId: number, responseIds: readonly number[]): Promise<Map<number, ReportEvidence>> {
  const out = new Map<number, ReportEvidence>();
  const ids = [...new Set(responseIds)];
  if (ids.length === 0) return out;

  const responses = await db.orm.public.InteractionResponse.where({ userId }).where((r) => r.id.in(ids)).all();
  if (responses.length === 0) return out;
  const interactionIds = [...new Set(responses.map((r) => r.interactionId))];
  const optionIds = responses.flatMap((r) => (r.selectedOptionId === null ? [] : [r.selectedOptionId]));
  const [interactions, options] = await Promise.all([
    db.orm.public.Interaction.where((i) => i.id.in(interactionIds)).all(),
    optionIds.length === 0 ? Promise.resolve([]) : db.orm.public.InteractionOption.where((o) => o.id.in(optionIds)).all(),
  ]);
  const videoIds = [...new Set(interactions.map((i) => i.videoId))];
  const videos = videoIds.length === 0 ? [] : await db.orm.public.Video.where((v) => v.id.in(videoIds)).all();
  const interactionOf = new Map(interactions.map((i) => [i.id, i]));
  const optionOf = new Map(options.map((o) => [o.id, o.text]));
  const titleOf = new Map(videos.map((v) => [v.id, v.title]));

  for (const r of responses) {
    const interaction = interactionOf.get(r.interactionId);
    if (!interaction) continue;
    const answer = r.selectedOptionId !== null ? optionOf.get(r.selectedOptionId) : r.textAnswer;
    if (!answer) continue;
    out.set(r.id, { responseId: r.id, story: titleOf.get(interaction.videoId) ?? "A story", question: interaction.question, answer, at: r.updatedAt });
  }
  return out;
}

type Candidate = { moduleId: number; title: string; virtueId: number; completed: boolean; activity: string; prompts: readonly string[] };

export async function getParentReport(userId: number, rules: ScoringRules = SCORING_RULES_V1, asOf: Date = new Date()): Promise<ParentReport> {
  const input = await loadAssessmentInput(userId, asOf);
  // Same engine call getAssessment makes; run twice over ONE input so the earlier rating set costs no extra queries.
  const assessment = buildAssessment(input, rules);
  const previous = buildAssessment({ ...input, ratings: ratingsBeforeLatestSet(input.ratings) }, rules);

  const swotItems = [...assessment.swot.strengths, ...assessment.swot.weaknesses, ...assessment.swot.opportunities, ...assessment.swot.threats];
  const [user, ratingRows, progress, moduleRows, secondaryRows, evidence] = await Promise.all([
    db.orm.public.User.where({ id: userId }).first(),
    db.orm.public.VirtueRating.where({ studentId: userId }).all(),
    db.orm.public.ModuleProgress.where({ userId }).all(),
    db.orm.public.Module.where({ status: "PUBLISHED" }).all(),
    db.orm.public.ModuleSecondaryVirtue.all(),
    resolveEvidence(userId, swotItems.flatMap((i) => i.evidenceResponseIds)),
  ]);
  if (!user) throw new Error("Student not found.");
  const videoIds = moduleRows.map((m) => m.videoId);
  const videos = videoIds.length === 0 ? [] : await db.orm.public.Video.where((v) => v.id.in(videoIds)).all();

  const childName = user.name.split(" ")[0] || user.name;
  const virtueById = new Map(input.virtues.map((v) => [v.id, v]));
  const slugOf = (id: number) => virtueById.get(id)!.slug as VirtueSlug;
  const nameOf = (id: number) => virtueById.get(id)?.name ?? "this virtue";
  const assessOf = new Map(assessment.virtues.map((v) => [v.virtueId, v]));

  // ---- per-virtue rows, fixed order (input.virtues is sorted by Virtue.position)
  // With "not enough data yet" the child's own score (a handful of answers) and the blend that includes it are withheld,
  // not shown as a number: the rating views of parent and teacher still show, as their own views.
  const virtues = assessment.virtues.map((v) => ({
    virtueId: v.virtueId,
    slug: slugOf(v.virtueId),
    name: nameOf(v.virtueId),
    composite: v.confidence === "insufficient" ? null : v.compositeScore,
    child: v.confidence === "insufficient" ? null : v.childScore,
    parent: v.parentScore,
    teacher: v.teacherScore,
    confidence: v.confidence,
    scoredInteractions: v.scoredInteractions,
    trend: v.trend,
    trendDelta: v.trendDelta,
    series: v.series,
    parentMark: v.parentMark,
    bigGap: v.confidence !== "insufficient" && v.parentScore !== null && v.childScore !== null && Math.abs(v.parentScore - v.childScore) >= rules.swot.threatGap,
  }));

  // ---- SWOT with evidence and wording for parents
  const toItem = (item: SwotItem): ReportSwotItem => ({
    virtueId: item.virtueId,
    slug: slugOf(item.virtueId),
    name: nameOf(item.virtueId),
    quadrant: item.quadrant,
    reason: parentReason(item, assessOf.get(item.virtueId)!, nameOf(item.virtueId), childName, rules),
    evidence: item.evidenceResponseIds.flatMap((id) => (evidence.has(id) ? [evidence.get(id)!] : [])),
  });
  const swot = {
    strengths: assessment.swot.strengths.map(toItem),
    weaknesses: assessment.swot.weaknesses.map(toItem),
    opportunities: assessment.swot.opportunities.map(toItem),
    threats: assessment.swot.threats.map(toItem),
  } satisfies Record<string, ReportSwotItem[]>;

  // ---- next steps
  const titleOf = new Map(videos.map((v) => [v.id, v.title]));
  const doneIds = new Set(progress.filter((p) => p.completedAt !== null).map((p) => p.moduleId));
  const candidatesFor = (virtueId: number): Candidate[] =>
    moduleRows
      .filter((m) => m.primaryVirtueId === virtueId || secondaryRows.some((s) => s.moduleId === m.id && s.virtueId === virtueId))
      .map((m) => ({
        moduleId: m.id,
        title: titleOf.get(m.videoId) ?? m.sourceStory,
        virtueId,
        completed: doneIds.has(m.id),
        activity: m.followUpActivity,
        prompts: m.discussionPrompts,
      }))
      // Not-yet-completed first, then by id so the order is stable.
      .sort((a, b) => Number(a.completed) - Number(b.completed) || a.moduleId - b.moduleId);

  const perVirtue = assessment.nextStepVirtueIds.map((id) => ({ id, list: candidatesFor(id) }));
  const picked: Candidate[] = [];
  for (let round = 0; picked.length < 3 && round < 3; round++)
    for (const { list } of perVirtue) {
      const next = list.find((c) => !picked.some((p) => p.moduleId === c.moduleId));
      if (next && picked.length < 3) picked.push(next);
    }
  const stories: ReportStep[] = picked.map((c) => ({ moduleId: c.moduleId, title: c.title, virtueName: nameOf(c.virtueId), completed: c.completed, activity: c.activity }));
  const questions = perVirtue.flatMap(({ id, list }) =>
    [...new Set(list.flatMap((c) => c.prompts))].slice(0, 2).map((question) => ({ virtueName: nameOf(id), question })),
  );

  const now = { weaknesses: assessment.swot.weaknesses.map((i) => i.virtueId), threats: assessment.swot.threats.map((i) => i.virtueId) };
  const before = previous.swot.weaknesses.map((i) => i.virtueId);
  const experts: ExpertSuggestion[] = now.weaknesses
    .filter((id) => isPersistentWeakness(id, now, before))
    .map((id) => ({ virtueId: id, virtueName: nameOf(id), categories: [...EXPERTS_BY_VIRTUE[slugOf(id)].categories], reason: EXPERTS_BY_VIRTUE[slugOf(id)].reason }));

  // ---- parent inputs: latest set next to the one before it (FR-4.13)
  const parentRows = ratingRows.filter((r) => r.raterKind === "PARENT");
  const parentDays = ratingSetDays(input.ratings, "PARENT");
  const setOf = (d: string | undefined) => (d ? parentRows.filter((r) => r.ratedAt.toISOString().slice(0, 10) === d) : []);
  const latestSet = setOf(parentDays[0]);
  const previousSet = setOf(parentDays[1]);
  // The report's headline "latest" per virtue is what the engine uses: the newest rating of that virtue.
  const latestFor = (virtueId: number) => parentRows.filter((r) => r.virtueId === virtueId).sort((a, b) => b.ratedAt.getTime() - a.ratedAt.getTime())[0];
  const teacherRows = ratingRows.filter((r) => r.raterKind === "TEACHER");
  const rows: ParentInputRow[] = input.virtues.map((v) => {
    const now = latestSet.find((r) => r.virtueId === v.id) ?? latestFor(v.id);
    const prev = previousSet.find((r) => r.virtueId === v.id);
    const latest = now ? { rating: now.rating, mark: now.mark, notes: now.notes } : null;
    const previousValue = prev ? { rating: prev.rating, mark: prev.mark } : null;
    const teacher = teacherRows.filter((r) => r.virtueId === v.id).sort((a, b) => b.ratedAt.getTime() - a.ratedAt.getTime())[0];
    return {
      virtueId: v.id,
      slug: slugOf(v.id),
      name: v.name,
      latest,
      previous: previousValue,
      change: describeParentChange(latest, previousValue),
      teacherRating: teacher?.rating ?? null,
    };
  });

  const strengthNames = assessment.swot.strengths.map((i) => nameOf(i.virtueId));
  const storiesFinished = progress.filter((p) => p.completedAt !== null).length;
  const lastActive = progress.reduce<Date | null>((latest, p) => (latest === null || p.updatedAt > latest ? p.updatedAt : latest), null);

  return {
    child: { name: childName, avatar: user.avatar, storiesFinished, lastActive },
    ruleVersion: assessment.ruleVersion,
    asOf: assessment.asOf,
    disclaimer: assessment.disclaimer,
    summary: { dataSentence: dataSentence(virtues, storiesFinished), strengthsSentence: strengthsSentence(strengthNames, childName) },
    virtues,
    swot,
    nextSteps: { stories, questions, experts },
    parentInputs: {
      latestSetAt: latestSet[0]?.ratedAt ?? null,
      previousSetAt: previousSet[0]?.ratedAt ?? null,
      raterName: latestSet[0]?.raterName ?? null,
      rows,
    },
  };
}
