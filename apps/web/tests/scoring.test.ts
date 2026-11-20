import { describe, expect, it } from "vitest";
import {
  SCORING_RULES_V1,
  blendComposite,
  buildAssessment,
  buildChildView,
  confidenceFor,
  ratingToScore,
  runningScore,
  scoreModule,
  trendFor,
  validateParentMarks,
  type AssessmentInput,
  type InteractionInput,
  type ModuleInput,
  type RatingInput,
} from "@/lib/scoring";

// Pure engine: no DB, no mocks needed.
const ASOF = new Date("2026-11-20T00:00:00Z");
const daysAgo = (n: number) => new Date(ASOF.getTime() - n * 86_400_000);
const V1 = { id: 1, slug: "self-discipline", name: "Self-Discipline" };
const V2 = { id: 2, slug: "compassion", name: "Compassion" };
const VIRTUES = [V1, V2];

let seq = 1;
/** An interaction whose options weigh virtue 1 as `weights` (null = no weight row). `chosen` is an index, or null = skipped. */
function interaction(weights: (number | null)[], chosen: number | null, virtueId = 1): InteractionInput {
  const options = weights.map((w) => ({ optionId: seq++, weights: w === null ? {} : { [virtueId]: w } }));
  const id = seq++;
  return { interactionId: id, options, response: chosen === null ? { responseId: seq++, chosenOptionId: null } : { responseId: seq++, chosenOptionId: options[chosen].optionId } };
}
/** Standard 3-option question: best +2, neutral (no row), worst -2. */
const q = (pick: "best" | "neutral" | "worst" | "skip", virtueId = 1) =>
  interaction([2, null, -2], pick === "best" ? 0 : pick === "neutral" ? 1 : pick === "worst" ? 2 : null, virtueId);
/** A 5-step question -2..+2 where `w` is the chosen weight. */
const q5 = (w: number) => interaction([-2, -1, 0, 1, 2], w + 2);

const mod = (moduleId: number, completedAt: Date | null, interactions: InteractionInput[]): ModuleInput => ({ moduleId, completedAt, interactions });
const repeat = (n: number, pick: Parameters<typeof q>[0]) => Array.from({ length: n }, () => q(pick));
const input = (modules: ModuleInput[], ratings: RatingInput[] = [], extra: Partial<AssessmentInput> = {}): AssessmentInput => ({
  asOf: ASOF,
  virtues: VIRTUES,
  modules,
  ratings,
  ...extra,
});
const rating = (raterKind: "PARENT" | "TEACHER", virtueId: number, r: number, mark: "NONE" | "STRENGTH" | "IMPROVE" = "NONE", ratedAt = daysAgo(1)): RatingInput => ({
  raterKind,
  virtueId,
  rating: r,
  mark,
  ratedAt,
});
const v = (a: ReturnType<typeof buildAssessment>, id = 1) => a.virtues.find((x) => x.virtueId === id)!;
const scoreOf = (m: ModuleInput, virtueId = 1) => scoreModule({ ...m, completedAt: daysAgo(1) }).byVirtue[virtueId]?.score;

describe("module score (min-max)", () => {
  it("a neutral answer scores 50", () => {
    expect(scoreOf(mod(1, daysAgo(1), [q("neutral")]))).toBe(50);
  });
  it("all-best is 100 and all-worst is 0", () => {
    expect(scoreOf(mod(1, daysAgo(1), [q("best"), q("best"), q("best")]))).toBe(100);
    expect(scoreOf(mod(1, daysAgo(1), [q("worst"), q("worst")]))).toBe(0);
  });
  it("mixes answers across interactions", () => {
    // earned 2+(-2)=0, min -4, max 4 -> 50
    expect(scoreOf(mod(1, daysAgo(1), [q("best"), q("worst")]))).toBe(50);
  });
  it("gives no score (not 0) to a virtue no interaction weighs", () => {
    const scores = scoreModule({ ...mod(1, daysAgo(1), [q("best")]), completedAt: daysAgo(1) });
    expect(scores.byVirtue[2]).toBeUndefined();
    expect(Object.keys(scores.byVirtue)).toEqual(["1"]);
  });
  it("ignores skipped and unanswered interactions", () => {
    expect(scoreOf(mod(1, daysAgo(1), [q("skip"), q("best")]))).toBe(100);
    const noAnswer: InteractionInput = { ...q("best"), response: null };
    expect(scoreOf(mod(1, daysAgo(1), [noAnswer]))).toBeUndefined();
    expect(scoreOf(mod(1, daysAgo(1), [q("skip")]))).toBeUndefined();
  });
  it("only counts interactions that weigh the virtue, and treats unweighted options as 0", () => {
    // interaction A weighs virtue 1 (best chosen); B weighs virtue 2 only and is ignored for virtue 1
    const m = mod(1, daysAgo(1), [q("best"), q("worst", 2)]);
    expect(scoreOf(m, 1)).toBe(100);
    expect(scoreOf(m, 2)).toBe(0);
  });
  it("is undefined when best and worst are identical (nothing to measure)", () => {
    expect(scoreOf(mod(1, daysAgo(1), [interaction([1, 1], 0)]))).toBeUndefined();
  });
  it("supports a 5-step scale", () => {
    expect(scoreOf(mod(1, daysAgo(1), [q5(1)]))).toBe(75);
  });
});

describe("running score (recency)", () => {
  it("weights the newest module most", () => {
    expect(runningScore([0, 100], 0.8)).toBeCloseTo(100 / 1.8);
    expect(runningScore([100, 0], 0.8)).toBeCloseTo(80 / 1.8);
    expect(runningScore([40], 0.8)).toBe(40);
    expect(runningScore([], 0.8)).toBeNull();
  });
  it("moves towards recent modules compared with a plain average", () => {
    const improving = buildAssessment(input([mod(1, daysAgo(30), repeat(4, "worst")), mod(2, daysAgo(5), repeat(4, "best"))]));
    expect(v(improving).childScore!).toBeGreaterThan(50);
    const declining = buildAssessment(input([mod(1, daysAgo(30), repeat(4, "best")), mod(2, daysAgo(5), repeat(4, "worst"))]));
    expect(v(declining).childScore!).toBeLessThan(50);
  });
  it("is configurable via the rules", () => {
    const rules = { ...SCORING_RULES_V1, version: "test", recencyDecay: 1 };
    const a = buildAssessment(input([mod(1, daysAgo(30), repeat(4, "worst")), mod(2, daysAgo(5), repeat(4, "best"))]), rules);
    expect(v(a).childScore).toBe(50);
    expect(a.ruleVersion).toBe("test");
  });
  it("counts a module only once completed", () => {
    const a = buildAssessment(input([mod(1, null, repeat(10, "best")), mod(2, daysAgo(-3), repeat(10, "best"))]));
    expect(v(a).childScore).toBeNull();
    expect(v(a).scoredInteractions).toBe(0);
  });
  it("returns a time series of the running score, oldest first", () => {
    const a = buildAssessment(input([mod(2, daysAgo(5), repeat(2, "best")), mod(1, daysAgo(30), repeat(2, "worst"))]));
    expect(v(a).series.map((p) => p.at)).toEqual([daysAgo(30), daysAgo(5)]);
    expect(v(a).series[0].score).toBe(0);
    expect(v(a).series[1].score).toBeCloseTo(100 / 1.8);
  });
});

describe("composite blend", () => {
  it("blends 60/25/15 when all sources exist", () => {
    expect(blendComposite({ child: 100, parent: 0, teacher: 0 })).toBeCloseTo(60);
    expect(blendComposite({ child: 80, parent: 40, teacher: 20 })).toBeCloseTo(0.6 * 80 + 0.25 * 40 + 0.15 * 20);
  });
  it("re-normalises when the teacher is missing", () => {
    expect(blendComposite({ child: 80, parent: 40, teacher: null })).toBeCloseTo((0.6 * 80 + 0.25 * 40) / 0.85);
  });
  it("re-normalises when the parent is missing", () => {
    expect(blendComposite({ child: 80, parent: null, teacher: 20 })).toBeCloseTo((0.6 * 80 + 0.15 * 20) / 0.75);
  });
  it("is the child score alone when both adults are missing, and null with no source", () => {
    expect(blendComposite({ child: 77, parent: null, teacher: null })).toBe(77);
    expect(blendComposite({ child: null, parent: 50, teacher: null })).toBe(50);
    expect(blendComposite({ child: null, parent: null, teacher: null })).toBeNull();
  });
  it("maps 1..5 ratings to 0..100 and uses the latest rating per kind", () => {
    expect([1, 2, 3, 4, 5].map((r) => ratingToScore(r))).toEqual([0, 25, 50, 75, 100]);
    const a = buildAssessment(input([mod(1, daysAgo(2), repeat(8, "best"))], [rating("PARENT", 1, 1, "NONE", daysAgo(10)), rating("PARENT", 1, 5, "NONE", daysAgo(2)), rating("TEACHER", 1, 3)]));
    expect(v(a).parentScore).toBe(100);
    expect(v(a).teacherScore).toBe(50);
    expect(v(a).compositeScore).toBeCloseTo(0.6 * 100 + 0.25 * 100 + 0.15 * 50);
  });
});

describe("confidence", () => {
  it.each([
    [0, "insufficient"],
    [7, "insufficient"],
    [8, "low"],
    [14, "low"],
    [15, "medium"],
    [29, "medium"],
    [30, "high"],
    [100, "high"],
  ] as const)("%i scored interactions -> %s", (n, band) => {
    expect(confidenceFor(n)).toBe(band);
    expect(v(buildAssessment(input([mod(1, daysAgo(2), repeat(n, "best"))]))).confidence).toBe(band);
  });
  it("leaves insufficient virtues out of the SWOT", () => {
    const few = buildAssessment(input([mod(1, daysAgo(2), repeat(7, "best"))]));
    expect(v(few).compositeScore).toBe(100); // still computed...
    expect(few.swot.strengths).toHaveLength(0); // ...but no verdict
    const enough = buildAssessment(input([mod(1, daysAgo(2), repeat(8, "best"))]));
    expect(enough.swot.strengths.map((s) => s.virtueId)).toEqual([1]);
  });
  it("counts interactions across modules", () => {
    const a = buildAssessment(input([mod(1, daysAgo(20), repeat(5, "best")), mod(2, daysAgo(2), repeat(5, "best"))]));
    expect(v(a).scoredInteractions).toBe(10);
    expect(v(a).confidence).toBe("low");
  });
});

describe("trend", () => {
  it("classifies the delta at the thresholds", () => {
    expect(trendFor(5)).toBe("rising");
    expect(trendFor(4.99)).toBe("stable");
    expect(trendFor(-4.99)).toBe("stable");
    expect(trendFor(-5)).toBe("falling");
    expect(trendFor(null)).toBe("stable");
  });
  it("compares now with the score as of 90 days ago", () => {
    const a = buildAssessment(input([mod(1, daysAgo(100), repeat(8, "worst")), mod(2, daysAgo(5), repeat(8, "best"))]));
    expect(v(a).trendDelta).toBeCloseTo(100 / 1.8);
    expect(v(a).trend).toBe("rising");
  });
  it("is stable with no data point that old", () => {
    const a = buildAssessment(input([mod(1, daysAgo(10), repeat(8, "best"))]));
    expect(v(a).trendDelta).toBeNull();
    expect(v(a).trend).toBe("stable");
  });
});

describe("SWOT quadrants", () => {
  it("Strength: composite >= 70 and trend stable", () => {
    const a = buildAssessment(input([mod(1, daysAgo(10), repeat(10, "best"))]));
    expect(a.swot.strengths.map((s) => s.virtueId)).toEqual([1]);
    expect(a.swot.weaknesses).toHaveLength(0);
  });
  it("Strength: also allowed with a rising trend", () => {
    const a = buildAssessment(input([mod(1, daysAgo(100), repeat(8, "neutral")), mod(2, daysAgo(5), repeat(8, "best"))]));
    expect(v(a).trend).toBe("rising");
    expect(v(a).compositeScore!).toBeGreaterThanOrEqual(70);
    expect(a.swot.strengths).toHaveLength(1);
  });
  it("Strength: excluded when the trend is falling", () => {
    const older = Array.from({ length: 5 }, (_, i) => mod(i + 1, daysAgo(120 - i), repeat(2, "best")));
    const a = buildAssessment(input([...older, mod(9, daysAgo(5), repeat(2, "neutral"))]));
    expect(v(a).compositeScore!).toBeGreaterThanOrEqual(70);
    expect(v(a).trend).toBe("falling");
    expect(a.swot.strengths).toHaveLength(0);
  });
  it("Weakness (path 1): composite < 45", () => {
    const a = buildAssessment(input([mod(1, daysAgo(10), repeat(8, "worst"))]));
    expect(a.swot.weaknesses.map((w) => w.virtueId)).toEqual([1]);
  });
  it("Weakness (path 2): parent marked 'improve' and the child's score confirms it (< 60)", () => {
    const mods = [mod(1, daysAgo(10), Array.from({ length: 8 }, () => q5(0)))]; // child 50
    const marked = buildAssessment(input(mods, [rating("PARENT", 1, 3, "IMPROVE")])); // parent 50 -> composite 50
    expect(v(marked).compositeScore).toBe(50);
    expect(marked.swot.weaknesses.map((w) => w.virtueId)).toEqual([1]);
    const unmarked = buildAssessment(input(mods, [rating("PARENT", 1, 3, "NONE")]));
    expect(unmarked.swot.weaknesses).toHaveLength(0);
  });
  it("Weakness (path 2) is not triggered when the child's score does not confirm it (>= 60)", () => {
    const mods = [mod(1, daysAgo(10), Array.from({ length: 8 }, () => q5(1)))]; // child 75
    const a = buildAssessment(input(mods, [rating("PARENT", 1, 3, "IMPROVE")]));
    expect(a.swot.weaknesses).toHaveLength(0);
  });
  it("Opportunity: composite 45-70 with a rising trend", () => {
    const a = buildAssessment(input([mod(1, daysAgo(100), repeat(8, "worst")), mod(2, daysAgo(5), repeat(8, "best"))]));
    expect(v(a).compositeScore!).toBeGreaterThan(45);
    expect(v(a).compositeScore!).toBeLessThan(70);
    expect(a.swot.opportunities.map((o) => o.virtueId)).toEqual([1]);
    expect(a.nextStepVirtueIds).toEqual([1]);
  });
  it("no Opportunity in the middle range when the trend is not rising", () => {
    const a = buildAssessment(input([mod(1, daysAgo(10), Array.from({ length: 8 }, () => q5(0)))]));
    expect(a.swot.opportunities).toHaveLength(0);
  });
  it("Threat (path 1): fell by >= 15 points over 3 months", () => {
    const a = buildAssessment(input([mod(1, daysAgo(100), repeat(8, "best")), mod(2, daysAgo(5), repeat(8, "worst"))]));
    expect(v(a).trendDelta!).toBeLessThanOrEqual(-15);
    expect(a.swot.threats.map((t) => t.virtueId)).toEqual([1]);
    expect(a.swot.threats[0].reason).toMatch(/dropped/);
  });
  it("no Threat for a drop smaller than 15", () => {
    const older = Array.from({ length: 5 }, (_, i) => mod(i + 1, daysAgo(120 - i), repeat(2, "best")));
    const a = buildAssessment(input([...older, mod(9, daysAgo(5), repeat(2, "neutral"))])); // delta about -13
    expect(v(a).trendDelta!).toBeGreaterThan(-15);
    expect(a.swot.threats).toHaveLength(0);
  });
  it("Threat (path 2): large gap between the parent's view and the child's responses", () => {
    const mods = [mod(1, daysAgo(10), repeat(8, "best"))];
    const gap = buildAssessment(input(mods, [rating("PARENT", 1, 1)])); // parent 0 vs child 100
    expect(v(gap).trendDelta).toBeNull();
    expect(gap.swot.threats.map((t) => t.virtueId)).toEqual([1]);
    expect(gap.swot.threats[0].reason).toMatch(/far apart/);
    const close = buildAssessment(input(mods, [rating("PARENT", 1, 5)]));
    expect(close.swot.threats).toHaveLength(0);
    const nearEdge = buildAssessment(input([mod(1, daysAgo(10), repeat(8, "best"))], [rating("PARENT", 1, 2)])); // |25-100| = 75
    expect(nearEdge.swot.threats).toHaveLength(1);
  });
  it("attaches up to 3 evidence response ids, strongest first", () => {
    const interactions = [q5(2), q5(1), q5(2), q5(0), q5(1), q5(2), q5(-1), q5(1)];
    const a = buildAssessment(input([mod(1, daysAgo(10), interactions)]));
    const item = a.swot.strengths[0];
    expect(item.evidenceResponseIds).toHaveLength(3);
    const weightOf = new Map(interactions.map((i, idx) => [i.response!.responseId, [2, 1, 2, 0, 1, 2, -1, 1][idx]]));
    expect(item.evidenceResponseIds.map((id) => weightOf.get(id))).toEqual([2, 2, 2]);
    const weak = buildAssessment(input([mod(1, daysAgo(10), repeat(8, "worst"))]));
    expect(weak.swot.weaknesses[0].evidenceResponseIds.length).toBeLessThanOrEqual(3);
    expect(weak.swot.weaknesses[0].evidenceResponseIds.length).toBeGreaterThan(0);
  });
  it("has a plain-language reason on every item", () => {
    const a = buildAssessment(input([mod(1, daysAgo(10), repeat(10, "best"))]));
    expect(a.swot.strengths[0].reason).toContain("Self-Discipline");
  });
});

describe("rule version, disclaimer and rating limits", () => {
  it("stamps every result with the rule version and the educational disclaimer", () => {
    const a = buildAssessment(input([]));
    expect(a.ruleVersion).toBe(SCORING_RULES_V1.version);
    expect(a.disclaimer).toMatch(/not a diagnosis/i);
    expect(buildChildView(input([])).ruleVersion).toBe(SCORING_RULES_V1.version);
  });
  it("enforces max 3 strengths and 3 improvements", () => {
    expect(validateParentMarks(["STRENGTH", "STRENGTH", "STRENGTH", "IMPROVE", "NONE"])).toBeNull();
    expect(validateParentMarks(["STRENGTH", "STRENGTH", "STRENGTH", "STRENGTH"])).toMatch(/at most 3 strengths/);
    expect(validateParentMarks(["IMPROVE", "IMPROVE", "IMPROVE", "IMPROVE"])).toMatch(/at most 3 areas/);
  });
});

describe("child view", () => {
  // A weak virtue (2), a strong one (1), plus journey structure.
  const strongAndWeak: AssessmentInput = input(
    [
      mod(1, daysAgo(10), [...repeat(10, "best"), ...Array.from({ length: 10 }, () => q("worst", 2))]),
      mod(2, daysAgo(5), repeat(1, "best")),
    ],
    [rating("PARENT", 2, 1, "IMPROVE")],
    { journeys: [{ journeyId: 7, title: "Kindness", modules: [{ moduleId: 1, level: 1 }, { moduleId: 2, level: 2 }, { moduleId: 3, level: 2 }] }] },
  );

  function allKeys(o: unknown, out: string[] = []): string[] {
    if (Array.isArray(o)) o.forEach((x) => allKeys(x, out));
    else if (o && typeof o === "object") for (const [k, val] of Object.entries(o)) {
      out.push(k);
      allKeys(val, out);
    }
    return out;
  }
  function numbersByKey(o: unknown, out: Record<string, number[]> = {}): Record<string, number[]> {
    if (Array.isArray(o)) o.forEach((x) => numbersByKey(x, out));
    else if (o && typeof o === "object")
      for (const [k, val] of Object.entries(o)) {
        if (typeof val === "number") (out[k] ??= []).push(val);
        else numbersByKey(val, out);
      }
    return out;
  }

  it("has no score, weakness, threat or confidence fields", () => {
    const view = buildChildView(strongAndWeak);
    const keys = allKeys(view);
    for (const k of keys) expect(k).not.toMatch(/score|percent|composite|weak|threat|opportunit|swot|confidence|trend|rank|improve/i);
    // The only numbers are ids and whole-number counts.
    expect(Object.keys(numbersByKey(view)).sort()).toEqual(["modulesCompleted", "stars", "total", "virtueId"].sort());
    for (const nums of Object.values(numbersByKey(view))) for (const n of nums) expect(Number.isInteger(n)).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/Compassion/); // the weak virtue is never named
  });
  it("shows strengths as superpowers and never the weak virtue", () => {
    const view = buildChildView(strongAndWeak);
    expect(view.superpowers).toEqual([{ virtueId: 1, name: "Self-Discipline" }]);
  });
  it("falls back to the top virtues when there are no strengths", () => {
    const view = buildChildView(input([mod(1, daysAgo(10), repeat(8, "neutral"))]));
    expect(view.superpowers.map((s) => s.virtueId)).toEqual([1]);
    expect(buildChildView(input([])).superpowers).toEqual([]);
  });
  it("awards module, journey-level and virtue-star badges and counts stars", () => {
    const view = buildChildView(strongAndWeak);
    const ids = view.badges.map((b) => b.id);
    expect(ids).toContain("module:1");
    expect(ids).toContain("module:2");
    expect(ids).toContain("journey-level:7:1"); // module 1 done
    expect(ids).not.toContain("journey-level:7:2"); // module 3 not done
    expect(ids).toEqual(expect.arrayContaining(["virtue:1:3", "virtue:1:6", "virtue:1:10"]));
    expect(view.stars.byVirtue.find((s) => s.virtueId === 1)!.stars).toBe(11);
    expect(view.stars.total).toBe(11);
    expect(view.modulesCompleted).toBe(2);
  });
});
