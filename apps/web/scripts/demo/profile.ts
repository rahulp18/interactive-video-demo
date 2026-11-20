import { buildAssessment, buildChildView, type AssessmentInput, type InteractionInput, type ModuleInput, type RatingInput } from "../../lib/scoring";
import { COMPLETED, RATINGS, type CompletedModule } from "./content/history";
import { JOURNEYS, MODULE_BY_SLUG, VIRTUE_SLUGS, type ModuleDef, type QuestionDef } from "./content";

// Pure helpers that turn the demo content + designed history into engine input, with no database. They let the
// profile be checked (and tuned) offline; the seed writes exactly the same choices to the DB.

/** Virtue ids in the offline model = display position (1..10), the same order the migration seeds. */
export const virtueIdOf = (slug: string) => VIRTUE_SLUGS.indexOf(slug as never) + 1;

/** Resolves a pick character to an option index of a question. */
export function pickIndex(q: QuestionDef, ch: string): number {
  if (/^[0-4]$/.test(ch)) {
    const i = Number(ch);
    if (q.style !== "RATING" || i >= q.options.length) throw new Error(`Digit pick "${ch}" is only valid on a RATING question`);
    return i;
  }
  const tone = ch === "g" ? "good" : ch === "n" ? "neutral" : ch === "p" ? "poor" : null;
  if (!tone) throw new Error(`Unknown pick "${ch}"`);
  const i = q.options.findIndex((o) => o.tone === tone);
  if (i < 0) throw new Error(`Question "${q.question}" has no ${tone} option`);
  return i;
}

/** Option index chosen for each question of a module. Throws when `picks` does not match the question count. */
export function resolvePicks(module: ModuleDef, picks: string): number[] {
  if (picks.length > module.questions.length) throw new Error(`${module.slug}: ${picks.length} picks for ${module.questions.length} questions`);
  return [...picks].map((ch, i) => pickIndex(module.questions[i], ch));
}

/** Virtue-weight map of one option, keyed by offline virtue id. */
const weightsOf = (w: Record<string, number> | undefined): Record<number, number> =>
  Object.fromEntries(Object.entries(w ?? {}).map(([slug, weight]) => [virtueIdOf(slug), weight]));

/** The engine's view of one completed module with the given picks (response ids are synthetic, unique per answer). */
export function moduleInput(module: ModuleDef, picks: string, completedAt: Date | null, moduleId: number): ModuleInput {
  const chosen = resolvePicks(module, picks);
  const interactions: InteractionInput[] = module.questions.map((q, qi) => {
    const options = q.options.map((o, oi) => ({ optionId: moduleId * 1000 + qi * 10 + oi, weights: weightsOf(o.w) }));
    return {
      interactionId: moduleId * 100 + qi,
      options,
      response: qi < chosen.length ? { responseId: moduleId * 1000 + qi, chosenOptionId: options[chosen[qi]].optionId } : null,
    };
  });
  return { moduleId, completedAt, interactions };
}

const DAY_MS = 86_400_000;
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

export function ratingInputs(now: Date): RatingInput[] {
  return RATINGS.flatMap((r) =>
    Object.entries(r.ratings).map(([slug, [rating, mark]]) => ({
      raterKind: r.raterKind,
      virtueId: virtueIdOf(slug),
      rating,
      mark,
      ratedAt: daysBefore(now, r.daysAgo),
    })),
  );
}

/** The designed demo student, as engine input, entirely offline. `completed` can be overridden to tune or test. */
export function demoAssessmentInput(now: Date, completed: CompletedModule[] = COMPLETED): AssessmentInput {
  const moduleIndex = (slug: string) => [...MODULE_BY_SLUG.keys()].indexOf(slug) + 1;
  return {
    asOf: now,
    virtues: VIRTUE_SLUGS.map((slug, i) => ({ id: i + 1, slug, name: slug })),
    modules: completed.map((c) => moduleInput(MODULE_BY_SLUG.get(c.slug)!, c.picks, daysBefore(now, c.daysAgo), moduleIndex(c.slug))),
    ratings: ratingInputs(now),
    journeys: JOURNEYS.map((j, ji) => ({
      journeyId: ji + 1,
      title: j.title,
      modules: j.levels.flatMap((slugs, li) => slugs.map((slug) => ({ moduleId: moduleIndex(slug), level: li + 1 }))),
    })),
  };
}

export const offlineAssessment = (now = new Date(), completed?: CompletedModule[]) => buildAssessment(demoAssessmentInput(now, completed));
export const offlineChildView = (now = new Date(), completed?: CompletedModule[]) => buildChildView(demoAssessmentInput(now, completed));

/** Human-readable table of the designed profile (used by the seed's summary and while tuning). */
export function describeProfile(a: ReturnType<typeof buildAssessment>, slugOf: (virtueId: number) => string = (id) => VIRTUE_SLUGS[id - 1]): string[] {
  const lines = ["virtue            child  parent teach  comp   conf          trend    delta"];
  for (const v of a.virtues) {
    const slug = slugOf(v.virtueId);
    const f = (n: number | null) => (n === null ? "  -  " : n.toFixed(0).padStart(4) + " ");
    lines.push(
      `${slug.padEnd(17)} ${f(v.childScore)} ${f(v.parentScore)} ${f(v.teacherScore)} ${f(v.compositeScore)}  ${`${v.confidence}(${v.scoredInteractions})`.padEnd(13)} ${v.trend.padEnd(8)} ${v.trendDelta === null ? "-" : v.trendDelta.toFixed(0)}`,
    );
  }
  const q = (name: string, items: { virtueId: number }[]) => `${name}: ${items.map((i) => slugOf(i.virtueId)).join(", ") || "-"}`;
  lines.push("", q("Strengths", a.swot.strengths), q("Weaknesses", a.swot.weaknesses), q("Opportunities", a.swot.opportunities), q("Threats", a.swot.threats));
  return lines;
}
