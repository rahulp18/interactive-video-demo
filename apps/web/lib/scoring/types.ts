// Plain data in, plain data out. Nothing here knows about the database, Next.js or I/O.

export type VirtueRef = { id: number; slug: string; name: string };

export type OptionInput = {
  optionId: number;
  /** virtueId -> weight (-2..+2, never 0). A virtue missing here means the option is neutral (0) for it. */
  weights: Readonly<Record<number, number>>;
};

export type InteractionInput = {
  interactionId: number;
  options: readonly OptionInput[];
  /** The user's latest answer. null, or a null `chosenOptionId`, means unanswered / skipped: it is not scored. */
  response: { responseId: number; chosenOptionId: number | null } | null;
};

export type ModuleInput = {
  moduleId: number;
  /** A module counts only once completed; incomplete modules are ignored. */
  completedAt: Date | null;
  interactions: readonly InteractionInput[];
};

export type RaterKind = "PARENT" | "TEACHER";
export type RatingMark = "NONE" | "STRENGTH" | "IMPROVE";

export type RatingInput = {
  raterKind: RaterKind;
  virtueId: number;
  /** 1..5 */
  rating: number;
  mark: RatingMark;
  ratedAt: Date;
};

export type JourneyInput = {
  journeyId: number;
  title: string;
  modules: readonly { moduleId: number; level: number }[];
};

export type AssessmentInput = {
  /** "Now". Passed in so the engine stays deterministic. */
  asOf: Date;
  virtues: readonly VirtueRef[];
  modules: readonly ModuleInput[];
  ratings: readonly RatingInput[];
  journeys?: readonly JourneyInput[];
};

export type Confidence = "insufficient" | "low" | "medium" | "high";
export type Trend = "rising" | "stable" | "falling";

/** One scored example answer, used as evidence. `weight` is what the chosen option scored for the virtue. */
export type Evidence = { responseId: number; weight: number; completedAt: Date };

export type ModuleVirtueScore = {
  virtueId: number;
  /** 0..100 (min-max scaled). */
  score: number;
  /** Answered interactions that carried a weight for this virtue. */
  interactionCount: number;
  evidence: Evidence[];
};

export type ModuleScores = {
  moduleId: number;
  completedAt: Date;
  byVirtue: Record<number, ModuleVirtueScore>;
};

export type SeriesPoint = { at: Date; score: number };

export type VirtueAssessment = {
  virtueId: number;
  /** Recency-weighted child score now, or null when the child has no scored module for this virtue. */
  childScore: number | null;
  /** Latest parent / teacher rating mapped to 0..100, or null. */
  parentScore: number | null;
  teacherScore: number | null;
  /** Blend of the available sources, or null when there is none. */
  compositeScore: number | null;
  /** Scored interactions behind the child score. */
  scoredInteractions: number;
  confidence: Confidence;
  trend: Trend;
  /** Running score now minus running score at the start of the window; null when there is no earlier data point. */
  trendDelta: number | null;
  /** Child running score after each completed module, oldest first (for charts). */
  series: SeriesPoint[];
  /** Latest parent mark (STRENGTH / IMPROVE / NONE). */
  parentMark: RatingMark;
};

export type Quadrant = "strength" | "weakness" | "opportunity" | "threat";

export type SwotItem = {
  virtueId: number;
  quadrant: Quadrant;
  /** Plain-language explanation. */
  reason: string;
  /** Up to `maxEvidence` response ids that illustrate the item. */
  evidenceResponseIds: number[];
};

export type Swot = {
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
};

export type Assessment = {
  ruleVersion: string;
  asOf: Date;
  /** Always shown with adult-facing reports. */
  disclaimer: string;
  /** In the fixed virtue order of the input. */
  virtues: VirtueAssessment[];
  swot: Swot;
  /** Virtues to find modules for: weaknesses first, then opportunities. The caller resolves these to modules. */
  nextStepVirtueIds: number[];
};

/**
 * What a child may see. Deliberately has NO score, percentage, rank, weakness or threat field, so those cannot be
 * returned by construction. Only whole-number counts of stars and modules appear.
 */
export type ChildBadge = {
  id: string;
  kind: "module" | "journey-level" | "virtue";
  title: string;
  virtueId: number | null;
};
export type ChildSuperpower = { virtueId: number; name: string };
export type ChildView = {
  ruleVersion: string;
  superpowers: ChildSuperpower[];
  badges: ChildBadge[];
  stars: { total: number; byVirtue: { virtueId: number; stars: number }[] };
  modulesCompleted: number;
};
