import type { VirtueSlug } from "./types";

/**
 * The demo student's designed history. Everything is relative to "now" (the moment of seeding/reset), so the 90-day
 * trend window always lines up: reset before each demo.
 *
 * `picks` has one character per question, in order: "g" good, "n" neutral, "p" poor for the first four (tone-labelled)
 * questions, and a digit "0".."4" for the final RATING question (0 = "Not at all like me" ... 4 = "Very much like me").
 *
 * The picks were chosen so that the demo student's assessment under SCORING_RULES_V1 lands on a designed profile
 * (checked by tests/demo-seed.test.ts). If you change a pick, a date, a rating or a weight, re-check that test.
 *
 *   Compassion      strength, high confidence (30 scored answers)
 *   Friendship      strength, medium confidence (15)
 *   Loyalty         strength
 *   Self-Discipline weakness by score (composite < 45)
 *   Honesty         weakness by parent mark (parent: area to improve, child < 60)
 *   Perseverance    opportunity (mid score, rising: a low early module, a high recent one)
 *   Responsibility  threat: fell by 15+ points inside 90 days
 *   Work            threat: parent's view (low) far from the child's answers (high)
 *   Courage         mid, no quadrant
 *   Faith           "not enough data yet" (3 scored answers; its own module is only in progress)
 */

export type CompletedModule = { slug: string; daysAgo: number; picks: string };

export const COMPLETED: CompletedModule[] = [
  { slug: "boy-who-cried-wolf", daysAgo: 118, picks: "gggp4" },
  { slug: "tortoise-and-the-hare", daysAgo: 110, picks: "pgnn0" },
  { slug: "injured-swan", daysAgo: 96, picks: "ngnp1" },
  { slug: "honest-woodcutter", daysAgo: 80, picks: "ngpg0" },
  { slug: "dove-and-the-ant", daysAgo: 62, picks: "gggg4" },
  { slug: "ant-and-the-grasshopper", daysAgo: 45, picks: "gggp1" },
  { slug: "pigeons-and-the-net", daysAgo: 28, picks: "gngg4" },
  { slug: "dog-and-the-reflection", daysAgo: 14, picks: "gpgp2" },
];

/** Started but not finished: its first answers are saved, `lastPositionSeconds` is part-way through the clip. */
export const IN_PROGRESS = { slug: "little-mango-seed", startedDaysAgo: 3, positionFraction: 0.4, picks: "gg" };

/** Not started, in a level that is already unlocked (Perseverance Path level 2, because level 1 is complete). */
export const NOT_STARTED = ["brave-little-parrot"];

export type DemoRating = {
  raterKind: "PARENT" | "TEACHER";
  raterName: string;
  daysAgo: number;
  /** virtue -> [rating 1-5, mark]. Teachers give no marks. */
  ratings: Partial<Record<VirtueSlug, [number, "NONE" | "STRENGTH" | "IMPROVE"]>>;
  notes?: Partial<Record<VirtueSlug, string>>;
};

export const RATINGS: DemoRating[] = [
  // An older parent set, kept as history of how the parent's view changed.
  {
    raterKind: "PARENT",
    raterName: "Priya (mother)",
    daysAgo: 95,
    ratings: {
      compassion: [4, "STRENGTH"],
      friendship: [3, "NONE"],
      loyalty: [4, "STRENGTH"],
      courage: [2, "IMPROVE"],
      perseverance: [2, "IMPROVE"],
      responsibility: [3, "NONE"],
      work: [3, "NONE"],
      honesty: [2, "IMPROVE"],
      "self-discipline": [2, "NONE"],
      faith: [3, "NONE"],
    },
  },
  // The current parent set: 10 virtues, 3 strengths, 2 areas to improve.
  {
    raterKind: "PARENT",
    raterName: "Priya (mother)",
    daysAgo: 6,
    ratings: {
      compassion: [5, "STRENGTH"],
      friendship: [4, "STRENGTH"],
      loyalty: [4, "STRENGTH"],
      courage: [3, "NONE"],
      perseverance: [3, "NONE"],
      responsibility: [3, "NONE"],
      work: [2, "NONE"],
      honesty: [3, "IMPROVE"],
      "self-discipline": [2, "IMPROVE"],
      faith: [4, "NONE"],
    },
    notes: {
      honesty: "Sometimes says what he thinks I want to hear.",
      work: "Needs reminders to help at home.",
      compassion: "Always the first to comfort his little sister.",
    },
  },
  {
    raterKind: "TEACHER",
    raterName: "Ms. Kapoor (class teacher)",
    daysAgo: 12,
    ratings: {
      compassion: [5, "NONE"],
      friendship: [4, "NONE"],
      "self-discipline": [2, "NONE"],
      work: [3, "NONE"],
      honesty: [4, "NONE"],
      perseverance: [3, "NONE"],
    },
  },
];

/** Deterministic, believable capture numbers per answer (so a reset reproduces exactly the same history). */
export function captureFor(slug: string, questionIndex: number): { responseTimeMs: number; replayCount: number; attemptCount: number } {
  let h = 2166136261;
  for (const c of `${slug}:${questionIndex}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return {
    responseTimeMs: 2800 + (h % 9700),
    replayCount: h % 17 === 0 ? 2 : h % 6 === 0 ? 1 : 0,
    attemptCount: h % 23 === 0 ? 2 : 1,
  };
}
