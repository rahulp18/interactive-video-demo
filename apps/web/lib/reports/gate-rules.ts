// The parental gate's rules, as pure functions (no database, no cookies), so they are easy to test.
//
// This is a gate against a child wandering into the grown-ups' page, NOT access control: access control is still
// `requireStudent` plus "it is the child's own data" (see decisions.md, 2026-11-20 Phase 6).

export const GATE = {
  /** How long one correct answer keeps the report open. */
  passMs: 15 * 60 * 1000,
  /** Wrong answers in a row before the cooldown starts. */
  maxFailures: 3,
  /** Cooldown after the last allowed wrong answer. */
  lockMs: 60 * 1000,
  /** Both numbers of the multiplication question come from this range (inclusive). */
  min: 6,
  max: 12,
} as const;

export type GateChallenge = { text: string; answer: number };

/** `randomInt(min, maxExclusive)` is injected so tests are deterministic and the server can use crypto. */
export function makeChallenge(randomInt: (min: number, maxExclusive: number) => number): GateChallenge {
  const a = randomInt(GATE.min, GATE.max + 1);
  const b = randomInt(GATE.min, GATE.max + 1);
  return { text: `${a} × ${b}`, answer: a * b };
}

export type GateState = { failures: number; lockedUntil: Date | null; answer: number | null };

export type GateOutcome =
  | { kind: "locked"; until: Date }
  | { kind: "no-question" }
  | { kind: "passed" }
  | { kind: "wrong"; failures: number; lockedUntil: Date | null };

/** Decides what an answer means. A locked gate refuses even a correct answer until the cooldown is over. */
export function evaluateAttempt(state: GateState, given: number, now: Date): GateOutcome {
  if (state.lockedUntil && state.lockedUntil.getTime() > now.getTime()) return { kind: "locked", until: state.lockedUntil };
  if (state.answer === null) return { kind: "no-question" };
  if (Number.isInteger(given) && given === state.answer) return { kind: "passed" };
  // An expired cooldown starts the count again.
  const before = state.lockedUntil ? 0 : state.failures;
  const failures = before + 1;
  const lockedUntil = failures >= GATE.maxFailures ? new Date(now.getTime() + GATE.lockMs) : null;
  return { kind: "wrong", failures: lockedUntil ? 0 : failures, lockedUntil };
}

/** Is a stored pass still valid right now? */
export function gateIsOpen(parentGateUntil: Date | null, now: Date): boolean {
  return parentGateUntil !== null && parentGateUntil.getTime() > now.getTime();
}
