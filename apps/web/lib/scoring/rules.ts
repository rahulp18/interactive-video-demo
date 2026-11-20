/**
 * Every tunable number of the virtue scoring and SWOT engine lives in ONE versioned object. A result always carries
 * the `version` of the rules that produced it. There is no admin UI: changing a rule means adding a new rules object
 * (SCORING_RULES_V2, ...) and passing it to the engine; old results stay traceable to the version they carry.
 */
export type ScoringRules = {
  readonly version: string;
  /** Blend of the three sources into the composite. A missing source is dropped and the rest are re-normalised. */
  readonly blend: { readonly child: number; readonly parent: number; readonly teacher: number };
  /** Rating scale of parent/teacher ratings; mapped linearly onto 0..100. */
  readonly ratingScale: { readonly min: number; readonly max: number };
  /** Per-module score decay going back in time: the newest module has weight 1, the one before it `decay`, then decay^2... */
  readonly recencyDecay: number;
  /** Scored-interaction counts that separate the confidence bands. Below `insufficientBelow` there is no verdict. */
  readonly confidence: { readonly insufficientBelow: number; readonly mediumFrom: number; readonly highFrom: number };
  /** Trend = running score now minus running score `windowDays` ago. */
  readonly trend: { readonly windowDays: number; readonly risingDelta: number; readonly fallingDelta: number };
  readonly swot: {
    /** Strength: composite >= this and trend not falling. */
    readonly strengthMin: number;
    /** Weakness: composite below this. */
    readonly weaknessBelow: number;
    /** Weakness: parent marked "area to improve" AND the child's own score is below this. */
    readonly improveConfirmedBelow: number;
    // Opportunity: composite in [weaknessBelow, strengthMin) with a rising trend (reuses those two thresholds).
    /** Threat: the child's score fell by at least this many points over the trend window. */
    readonly threatDrop: number;
    /** Threat: |parent view - child score| at least this large. */
    readonly threatGap: number;
    /** Evidence responses attached to each quadrant item. */
    readonly maxEvidence: number;
  };
  readonly ratings: { readonly maxStrengths: number; readonly maxImprove: number };
  readonly badges: {
    /** A virtue badge is earned at each of these star counts for that virtue. */
    readonly virtueStarMilestones: readonly number[];
    /** With no strengths yet, show this many top virtues as superpowers. */
    readonly fallbackSuperpowers: number;
  };
};

export const SCORING_RULES_V1: ScoringRules = {
  version: "v1",
  blend: { child: 0.6, parent: 0.25, teacher: 0.15 },
  ratingScale: { min: 1, max: 5 },
  recencyDecay: 0.8,
  confidence: { insufficientBelow: 8, mediumFrom: 15, highFrom: 30 },
  trend: { windowDays: 90, risingDelta: 5, fallingDelta: -5 },
  swot: {
    strengthMin: 70,
    weaknessBelow: 45,
    improveConfirmedBelow: 60,
    threatDrop: 15,
    threatGap: 30,
    maxEvidence: 3,
  },
  ratings: { maxStrengths: 3, maxImprove: 3 },
  badges: { virtueStarMilestones: [3, 6, 10], fallbackSuperpowers: 3 },
};

/** Shown on every adult-facing report (FR-6.16). */
export const EDUCATIONAL_DISCLAIMER =
  "This is an educational indicator based on a child's answers to story questions and on adult ratings. It is not a diagnosis or a psychological assessment.";
