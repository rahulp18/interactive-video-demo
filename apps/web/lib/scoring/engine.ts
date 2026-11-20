import { EDUCATIONAL_DISCLAIMER, SCORING_RULES_V1, type ScoringRules } from "./rules";
import type {
  Assessment,
  AssessmentInput,
  ChildBadge,
  ChildView,
  Confidence,
  Evidence,
  InteractionInput,
  ModuleInput,
  ModuleScores,
  ModuleVirtueScore,
  Quadrant,
  RatingInput,
  RatingMark,
  SeriesPoint,
  Swot,
  SwotItem,
  Trend,
  VirtueAssessment,
} from "./types";

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- module scores

/**
 * Raw per-virtue score of ONE module, 0..100, min-max scaled.
 *
 * Only answered (not skipped) interactions whose options carry a weight for the virtue are considered. For each, the
 * chosen option's weight is `earned`; `max`/`min` are the best/worst weight any option could have given (an option
 * with no weight for the virtue counts as 0). score = (earned - min) / (max - min) * 100, so a neutral answer sits
 * in the middle, all-best is 100 and all-worst is 0. A virtue with no weighted answered interaction (or no spread
 * between best and worst) gets NO entry, which is different from a score of 0.
 */
export function scoreModule(module: ModuleInput & { completedAt: Date }): ModuleScores {
  const acc = new Map<number, { earned: number; max: number; min: number; count: number; evidence: Evidence[] }>();
  for (const interaction of module.interactions) {
    const chosen = chosenOption(interaction);
    if (!chosen) continue;
    const virtueIds = new Set(interaction.options.flatMap((o) => Object.keys(o.weights).map(Number)));
    for (const virtueId of virtueIds) {
      const weightOf = (o: { weights: Readonly<Record<number, number>> }) => o.weights[virtueId] ?? 0;
      const weights = interaction.options.map(weightOf);
      const entry = acc.get(virtueId) ?? { earned: 0, max: 0, min: 0, count: 0, evidence: [] };
      const w = weightOf(chosen);
      entry.earned += w;
      entry.max += Math.max(...weights);
      entry.min += Math.min(...weights);
      entry.count += 1;
      entry.evidence.push({ responseId: interaction.response!.responseId, weight: w, completedAt: module.completedAt });
      acc.set(virtueId, entry);
    }
  }
  const byVirtue: Record<number, ModuleVirtueScore> = {};
  for (const [virtueId, e] of acc) {
    if (e.max === e.min) continue; // no spread: nothing to measure
    byVirtue[virtueId] = {
      virtueId,
      score: ((e.earned - e.min) / (e.max - e.min)) * 100,
      interactionCount: e.count,
      evidence: e.evidence,
    };
  }
  return { moduleId: module.moduleId, completedAt: module.completedAt, byVirtue };
}

function chosenOption(i: InteractionInput) {
  const id = i.response?.chosenOptionId;
  if (id == null) return null;
  return i.options.find((o) => o.optionId === id) ?? null;
}

/** Completed modules (completedAt set and not after `asOf`), scored, oldest first. */
export function scoreCompletedModules(modules: readonly ModuleInput[], asOf: Date): ModuleScores[] {
  return modules
    .filter((m): m is ModuleInput & { completedAt: Date } => m.completedAt !== null && m.completedAt.getTime() <= asOf.getTime())
    .map(scoreModule)
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime() || a.moduleId - b.moduleId);
}

// ---------------------------------------------------------------- running score, trend, composite

/**
 * Recency-weighted average of one virtue's module scores. `scores` are oldest first; the newest gets weight 1, the one
 * before it `decay`, then decay^2, and so on. Null for an empty list.
 */
export function runningScore(scores: readonly number[], decay: number): number | null {
  if (scores.length === 0) return null;
  let sum = 0;
  let total = 0;
  scores.forEach((s, i) => {
    const w = decay ** (scores.length - 1 - i);
    sum += s * w;
    total += w;
  });
  return sum / total;
}

/** Child running score after each module that scored the virtue, oldest first. */
function buildSeries(modules: readonly ModuleScores[], virtueId: number, decay: number): SeriesPoint[] {
  const scores: number[] = [];
  const series: SeriesPoint[] = [];
  for (const m of modules) {
    const s = m.byVirtue[virtueId];
    if (!s) continue;
    scores.push(s.score);
    series.push({ at: m.completedAt, score: runningScore(scores, decay)! });
  }
  return series;
}

/** Maps a rating on the rules' scale (1..5) to 0..100. */
export function ratingToScore(rating: number, rules: ScoringRules = SCORING_RULES_V1): number {
  const { min, max } = rules.ratingScale;
  return ((rating - min) / (max - min)) * 100;
}

/**
 * Blend child / parent / teacher scores. A missing source (null) is dropped and the remaining blend weights are
 * re-normalised to sum to 1. Null when every source is missing.
 */
export function blendComposite(
  sources: { child: number | null; parent: number | null; teacher: number | null },
  rules: ScoringRules = SCORING_RULES_V1,
): number | null {
  let sum = 0;
  let weight = 0;
  for (const key of ["child", "parent", "teacher"] as const) {
    const v = sources[key];
    if (v === null) continue;
    sum += v * rules.blend[key];
    weight += rules.blend[key];
  }
  return weight === 0 ? null : sum / weight;
}

export function confidenceFor(scoredInteractions: number, rules: ScoringRules = SCORING_RULES_V1): Confidence {
  const c = rules.confidence;
  if (scoredInteractions < c.insufficientBelow) return "insufficient";
  if (scoredInteractions < c.mediumFrom) return "low";
  if (scoredInteractions < c.highFrom) return "medium";
  return "high";
}

export function trendFor(delta: number | null, rules: ScoringRules = SCORING_RULES_V1): Trend {
  if (delta === null) return "stable";
  if (delta >= rules.trend.risingDelta) return "rising";
  if (delta <= rules.trend.fallingDelta) return "falling";
  return "stable";
}

/** Latest rating of one kind for a virtue (by ratedAt), or undefined. */
function latestRating(ratings: readonly RatingInput[], kind: RatingInput["raterKind"], virtueId: number): RatingInput | undefined {
  let best: RatingInput | undefined;
  for (const r of ratings) {
    if (r.raterKind !== kind || r.virtueId !== virtueId) continue;
    if (!best || r.ratedAt.getTime() >= best.ratedAt.getTime()) best = r;
  }
  return best;
}

/** Checks the "max N strengths / N areas to improve" rule on a set of parent marks. Returns an error text or null. */
export function validateParentMarks(
  marks: readonly RatingMark[],
  rules: ScoringRules = SCORING_RULES_V1,
): string | null {
  const strengths = marks.filter((m) => m === "STRENGTH").length;
  const improve = marks.filter((m) => m === "IMPROVE").length;
  if (strengths > rules.ratings.maxStrengths) return `Mark at most ${rules.ratings.maxStrengths} strengths.`;
  if (improve > rules.ratings.maxImprove) return `Mark at most ${rules.ratings.maxImprove} areas to improve.`;
  return null;
}

// ---------------------------------------------------------------- assessment + SWOT

export function buildAssessment(input: AssessmentInput, rules: ScoringRules = SCORING_RULES_V1): Assessment {
  const modules = scoreCompletedModules(input.modules, input.asOf);
  const cutoff = input.asOf.getTime() - rules.trend.windowDays * DAY_MS;
  const nameOf = new Map(input.virtues.map((v) => [v.id, v.name]));

  const virtues: VirtueAssessment[] = input.virtues.map((v) => {
    const series = buildSeries(modules, v.id, rules.recencyDecay);
    const moduleScores = modules.flatMap((m) => (m.byVirtue[v.id] ? [m.byVirtue[v.id].score] : []));
    const childScore = runningScore(moduleScores, rules.recencyDecay);
    const scoredInteractions = modules.reduce((n, m) => n + (m.byVirtue[v.id]?.interactionCount ?? 0), 0);

    // Score as of the start of the window = last series point at or before the cutoff.
    const before = series.filter((p) => p.at.getTime() <= cutoff).at(-1);
    const trendDelta = childScore !== null && before ? childScore - before.score : null;

    const parent = latestRating(input.ratings, "PARENT", v.id);
    const teacher = latestRating(input.ratings, "TEACHER", v.id);
    const parentScore = parent ? ratingToScore(parent.rating, rules) : null;
    const teacherScore = teacher ? ratingToScore(teacher.rating, rules) : null;

    return {
      virtueId: v.id,
      childScore,
      parentScore,
      teacherScore,
      compositeScore: blendComposite({ child: childScore, parent: parentScore, teacher: teacherScore }, rules),
      scoredInteractions,
      confidence: confidenceFor(scoredInteractions, rules),
      trend: trendFor(trendDelta, rules),
      trendDelta,
      series,
      parentMark: parent?.mark ?? "NONE",
    };
  });

  // Evidence pool per virtue, from every counted module.
  const evidencePool = new Map<number, Evidence[]>();
  for (const m of modules)
    for (const s of Object.values(m.byVirtue)) evidencePool.set(s.virtueId, [...(evidencePool.get(s.virtueId) ?? []), ...s.evidence]);
  const evidenceFor = (virtueId: number, kind: "positive" | "negative") => {
    const pool = [...(evidencePool.get(virtueId) ?? [])];
    // Strongest examples first; among equals the most recent.
    pool.sort((a, b) => (kind === "positive" ? b.weight - a.weight : a.weight - b.weight) || b.completedAt.getTime() - a.completedAt.getTime());
    return pool
      .filter((e) => (kind === "positive" ? e.weight > 0 : e.weight < 0))
      .slice(0, rules.swot.maxEvidence)
      .map((e) => e.responseId);
  };

  const swot: Swot = { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  const item = (virtueId: number, quadrant: Quadrant, reason: string, kind: "positive" | "negative"): SwotItem => ({
    virtueId,
    quadrant,
    reason,
    evidenceResponseIds: evidenceFor(virtueId, kind),
  });
  const s = rules.swot;

  for (const v of virtues) {
    // Not enough data yet: no verdict at all for this virtue.
    if (v.confidence === "insufficient" || v.compositeScore === null) continue;
    const name = nameOf.get(v.virtueId) ?? "this virtue";
    const composite = v.compositeScore;

    if (composite >= s.strengthMin && v.trend !== "falling")
      swot.strengths.push(item(v.virtueId, "strength", `${name} is a strength: it is consistently high and ${v.trend === "rising" ? "still growing" : "holding steady"}.`, "positive"));

    if (composite < s.weaknessBelow)
      swot.weaknesses.push(item(v.virtueId, "weakness", `${name} is still developing: the overall picture is on the low side.`, "negative"));
    else if (v.parentMark === "IMPROVE" && v.childScore !== null && v.childScore < s.improveConfirmedBelow)
      swot.weaknesses.push(item(v.virtueId, "weakness", `A parent chose ${name} as an area to improve, and the story answers agree.`, "negative"));

    if (composite >= s.weaknessBelow && composite < s.strengthMin && v.trend === "rising")
      swot.opportunities.push(item(v.virtueId, "opportunity", `${name} is in the middle range and improving: a good chance to build it further.`, "positive"));

    if (v.trendDelta !== null && v.trendDelta <= -s.threatDrop)
      swot.threats.push(item(v.virtueId, "threat", `${name} dropped by ${Math.round(-v.trendDelta)} points over the last ${rules.trend.windowDays} days.`, "negative"));
    else if (v.parentScore !== null && v.childScore !== null && Math.abs(v.parentScore - v.childScore) >= s.threatGap)
      swot.threats.push(item(v.virtueId, "threat", `A parent's view of ${name} and the child's own story answers are far apart; worth a conversation.`, "negative"));
  }

  const nextStepVirtueIds = [...new Set([...swot.weaknesses, ...swot.opportunities].map((i) => i.virtueId))];
  return { ruleVersion: rules.version, asOf: input.asOf, disclaimer: EDUCATIONAL_DISCLAIMER, virtues, swot, nextStepVirtueIds };
}

// ---------------------------------------------------------------- child view

/**
 * The encouraging, child-safe projection (FR-6.15): superpowers, badges and star counts only. The return type has no
 * score, percentage, weakness or threat field, so none can leak. Stars: one per answer whose chosen option had a
 * positive weight for a virtue.
 */
export function buildChildView(input: AssessmentInput, rules: ScoringRules = SCORING_RULES_V1): ChildView {
  const assessment = buildAssessment(input, rules);
  const modules = scoreCompletedModules(input.modules, input.asOf);
  const nameOf = new Map(input.virtues.map((v) => [v.id, v]));

  const starsByVirtue = new Map<number, number>(input.virtues.map((v) => [v.id, 0]));
  for (const m of modules)
    for (const s of Object.values(m.byVirtue))
      starsByVirtue.set(s.virtueId, (starsByVirtue.get(s.virtueId) ?? 0) + s.evidence.filter((e) => e.weight > 0).length);

  // Superpowers: the strengths, else the top virtues the child has shown any data for.
  let superIds = assessment.swot.strengths.map((i) => i.virtueId);
  if (superIds.length === 0) {
    superIds = assessment.virtues
      .filter((v) => v.childScore !== null && v.confidence !== "insufficient")
      .sort((a, b) => b.compositeScore! - a.compositeScore!)
      .slice(0, rules.badges.fallbackSuperpowers)
      .map((v) => v.virtueId);
  }

  const badges: ChildBadge[] = [];
  for (const m of modules) badges.push({ id: `module:${m.moduleId}`, kind: "module", title: "Story finished", virtueId: null });
  const done = new Set(modules.map((m) => m.moduleId));
  for (const j of input.journeys ?? []) {
    const levels = [...new Set(j.modules.map((m) => m.level))].sort((a, b) => a - b);
    for (const level of levels) {
      if (j.modules.filter((m) => m.level === level).every((m) => done.has(m.moduleId)))
        badges.push({ id: `journey-level:${j.journeyId}:${level}`, kind: "journey-level", title: `${j.title}: level ${level} complete`, virtueId: null });
    }
  }
  for (const [virtueId, stars] of starsByVirtue) {
    for (const milestone of rules.badges.virtueStarMilestones) {
      if (stars >= milestone)
        badges.push({ id: `virtue:${virtueId}:${milestone}`, kind: "virtue", title: `${nameOf.get(virtueId)?.name ?? "Virtue"} star ${milestone}`, virtueId });
    }
  }

  const byVirtue = input.virtues.map((v) => ({ virtueId: v.id, stars: starsByVirtue.get(v.id) ?? 0 }));
  return {
    ruleVersion: rules.version,
    superpowers: superIds.map((id) => ({ virtueId: id, name: nameOf.get(id)?.name ?? "" })),
    badges,
    stars: { total: byVirtue.reduce((n, v) => n + v.stars, 0), byVirtue },
    modulesCompleted: modules.length,
  };
}
