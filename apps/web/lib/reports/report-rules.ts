// Pure decisions for the parent report: wording for parents, the expert-category rule, rating sets. No database access.
import type { ScoringRules } from "@/lib/scoring/rules";
import type { RatingInput, SwotItem, VirtueAssessment } from "@/lib/scoring/types";
import type { VirtueSlug } from "@/lib/virtues/display";

// ------------------------------------------------------------------ expert categories (FR-7.1, text only)

export type ExpertCategory =
  | "Health / Paediatrics"
  | "Yoga"
  | "Meditation / Mindfulness"
  | "Child Psychology / Counselling"
  | "Child Psychiatry"
  | "NLP Coaching"
  | "Sports Coaching"
  | "Nutrition";

/** Static virtue -> category map with a short reason. No booking, no marketplace: it is only wording. */
export const EXPERTS_BY_VIRTUE: Record<VirtueSlug, { categories: ExpertCategory[]; reason: string }> = {
  "self-discipline": { categories: ["Meditation / Mindfulness", "Yoga"], reason: "Calm-focus practices can help children learn to pause before they act." },
  compassion: { categories: ["Child Psychology / Counselling"], reason: "A counsellor can help a child recognise and respond to other people's feelings." },
  responsibility: { categories: ["NLP Coaching"], reason: "Coaching can help build routines and a sense of ownership." },
  friendship: { categories: ["Child Psychology / Counselling"], reason: "A counsellor can help with making and keeping friends." },
  work: { categories: ["NLP Coaching", "Sports Coaching"], reason: "Goal-setting coaching or a team sport can build effort and follow-through." },
  courage: { categories: ["Sports Coaching", "Child Psychology / Counselling"], reason: "Gradual, supported challenges can build confidence." },
  perseverance: { categories: ["Sports Coaching", "NLP Coaching"], reason: "Practising something hard, with encouragement, builds staying power." },
  honesty: { categories: ["Child Psychology / Counselling"], reason: "A counsellor can help a child feel safe telling the truth." },
  loyalty: { categories: ["Child Psychology / Counselling"], reason: "A counsellor can help with trust and belonging." },
  faith: { categories: ["Meditation / Mindfulness"], reason: "Quiet reflection can help a child explore what they believe in." },
};

/**
 * A weakness is "persistent" (so an expert category may be mentioned, FR-6.13) only when it is a weakness now AND it is
 * also a threat now, or was a weakness on the previous rating set. One low reading alone never triggers a suggestion.
 */
export function isPersistentWeakness(virtueId: number, now: { weaknesses: number[]; threats: number[] }, previousWeaknesses: number[]): boolean {
  return now.weaknesses.includes(virtueId) && (now.threats.includes(virtueId) || previousWeaknesses.includes(virtueId));
}

/**
 * The overall score that may be DRAWN for a virtue. "Not enough data yet" gives null (an empty axis), never 0, and the
 * composite is withheld even when a parent rating alone could produce one: the child's own data is what is missing.
 */
export function plottedComposite(v: { confidence: string; composite: number | null }): number | null {
  return v.confidence === "insufficient" ? null : v.composite;
}

// ------------------------------------------------------------------ rating sets (FR-4.13)

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Distinct rating days for one rater kind, newest first. A "set" is everything a rater entered on the same day. */
export function ratingSetDays(ratings: readonly RatingInput[], kind: "PARENT" | "TEACHER"): string[] {
  return [...new Set(ratings.filter((r) => r.raterKind === kind).map((r) => day(r.ratedAt)))].sort().reverse();
}

/** The ratings as they stood before the latest set of each kind (a kind with a single set is left as it is). */
export function ratingsBeforeLatestSet(ratings: readonly RatingInput[]): RatingInput[] {
  const latest = new Map<string, string>();
  for (const kind of ["PARENT", "TEACHER"] as const) {
    const days = ratingSetDays(ratings, kind);
    if (days.length >= 2) latest.set(kind, days[0]);
  }
  return ratings.filter((r) => latest.get(r.raterKind) !== day(r.ratedAt));
}

const MARK_TEXT = { STRENGTH: "marked as a strength", IMPROVE: "marked as something to work on", NONE: "no mark" } as const;

/** Describes what changed between two parent ratings of one virtue, or null when nothing did. */
export function describeParentChange(
  latest: { rating: number; mark: keyof typeof MARK_TEXT } | null,
  previous: { rating: number; mark: keyof typeof MARK_TEXT } | null,
): string | null {
  if (!latest || !previous) return null;
  const parts: string[] = [];
  if (latest.rating !== previous.rating) parts.push(`rating went from ${previous.rating} to ${latest.rating}`);
  if (latest.mark !== previous.mark) parts.push(`${MARK_TEXT[previous.mark]} before, now ${MARK_TEXT[latest.mark]}`);
  if (parts.length === 0) return null;
  const text = parts.join("; ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ------------------------------------------------------------------ wording for parents

/**
 * Rewrites an engine reason for a parent. The engine's text reads like a rule ("the overall picture is on the low side",
 * "the story answers agree"), so this builds a neutral sentence from the same facts: "still developing", never "bad at".
 */
export function parentReason(item: Pick<SwotItem, "quadrant">, v: VirtueAssessment, virtueName: string, childName: string, rules: ScoringRules): string {
  switch (item.quadrant) {
    case "strength":
      return `${virtueName} is going well. ${childName}'s answers are consistently thoughtful here${v.trend === "rising" ? ", and still improving" : ""}.`;
    case "weakness":
      if (v.compositeScore !== null && v.compositeScore < rules.swot.weaknessBelow)
        return `${virtueName} is still developing. There is room to grow, and the stories below are good places to start talking about it.`;
      return `You marked ${virtueName} as something to work on, and ${childName}'s own story answers point the same way. It is still developing.`;
    case "opportunity":
      return `${virtueName} is coming along and getting better. A little encouragement could help it grow further.`;
    case "threat":
      if (v.trendDelta !== null && v.trendDelta <= -rules.swot.threatDrop)
        return `${childName}'s ${virtueName} answers have dipped by about ${Math.round(-v.trendDelta)} points over the last ${rules.trend.windowDays} days. A friendly chat may help.`;
      return `Your rating of ${virtueName} and ${childName}'s own story answers are quite different. That is worth talking about together; what shows up at home may differ from what shows up in the stories.`;
  }
}

export function dataSentence(virtues: readonly { confidence: string }[], storiesFinished: number): string {
  const enough = virtues.filter((v) => v.confidence !== "insufficient").length;
  const solid = virtues.filter((v) => v.confidence === "high" || v.confidence === "medium").length;
  const stories = `${storiesFinished} ${storiesFinished === 1 ? "story" : "stories"}`;
  if (enough === 0) return `After ${stories}, there is not enough data yet for any virtue. A virtue shows a score once it has at least 8 answered questions.`;
  return `After ${stories}, ${enough} of ${virtues.length} virtues have enough data to show (${solid} with medium or high confidence). The rest say "not enough data yet" instead of a score.`;
}

export function strengthsSentence(names: readonly string[], childName: string): string {
  if (names.length === 0) return "No clear strengths have shown up yet, which is normal early on. Keep watching stories together.";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${childName}'s strongest virtues right now are ${list}.`;
}
