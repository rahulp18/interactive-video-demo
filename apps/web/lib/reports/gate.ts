import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/prisma/db";
import { hashToken } from "@/lib/auth/session";
import { GATE, evaluateAttempt, gateIsOpen, makeChallenge } from "./gate-rules";

// The gate lives on the Session row (columns parentGate*), so it cannot be forged by editing a cookie and it disappears
// with the session at logout. The expected answer stays in this table; the browser only ever receives the question text.

export type ChallengeReply = { status: "question"; text: string } | { status: "locked"; retryAfterSeconds: number } | { status: "open" };
export type AnswerReply =
  | { status: "open" }
  | { status: "wrong"; text: string }
  | { status: "locked"; retryAfterSeconds: number };

async function sessionFor(token: string) {
  return db.orm.public.Session.where({ tokenHash: hashToken(token) }).first();
}

const seconds = (until: Date, now: Date) => Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));

async function issue(sessionId: number): Promise<string> {
  const challenge = makeChallenge(randomInt);
  await db.orm.public.Session.where({ id: sessionId }).updateAll({ parentGateChallenge: challenge.text, parentGateAnswer: challenge.answer });
  return challenge.text;
}

/** True only while a pass is stored on THIS session and has not run out. */
export async function hasGatePass(token: string, now = new Date()): Promise<boolean> {
  const session = await sessionFor(token);
  return !!session && gateIsOpen(session.parentGateUntil, now);
}

/** The current question (a new one is made when none is pending or the page is opened afresh). */
export async function getChallenge(token: string, now = new Date()): Promise<ChallengeReply> {
  const session = await sessionFor(token);
  if (!session) return { status: "locked", retryAfterSeconds: 60 };
  if (gateIsOpen(session.parentGateUntil, now)) return { status: "open" };
  if (session.parentGateLockedUntil && session.parentGateLockedUntil.getTime() > now.getTime()) {
    return { status: "locked", retryAfterSeconds: seconds(session.parentGateLockedUntil, now) };
  }
  // Re-use a pending question on reload so refreshing is not a way to shop for an easy one.
  if (session.parentGateChallenge && session.parentGateAnswer !== null) return { status: "question", text: session.parentGateChallenge };
  return { status: "question", text: await issue(session.id) };
}

/** Checks an answer. A wrong answer always replaces the question; repeated misses start a cooldown. */
export async function submitAnswer(token: string, given: number, now = new Date()): Promise<AnswerReply> {
  const session = await sessionFor(token);
  if (!session) return { status: "locked", retryAfterSeconds: 60 };
  const outcome = evaluateAttempt(
    { failures: session.parentGateFailures, lockedUntil: session.parentGateLockedUntil, answer: session.parentGateAnswer },
    given,
    now,
  );
  switch (outcome.kind) {
    case "locked":
      return { status: "locked", retryAfterSeconds: seconds(outcome.until, now) };
    case "no-question":
      return { status: "wrong", text: await issue(session.id) };
    case "passed":
      await db.orm.public.Session.where({ id: session.id }).updateAll({
        parentGateUntil: new Date(now.getTime() + GATE.passMs),
        parentGateFailures: 0,
        parentGateLockedUntil: null,
        parentGateChallenge: null,
        parentGateAnswer: null,
      });
      return { status: "open" };
    case "wrong": {
      await db.orm.public.Session.where({ id: session.id }).updateAll({
        parentGateFailures: outcome.failures,
        parentGateLockedUntil: outcome.lockedUntil,
        parentGateChallenge: null,
        parentGateAnswer: null,
      });
      if (outcome.lockedUntil) return { status: "locked", retryAfterSeconds: seconds(outcome.lockedUntil, now) };
      return { status: "wrong", text: await issue(session.id) };
    }
  }
}

/** "Back to the app": closes the gate at once. */
export async function endGate(token: string): Promise<void> {
  const session = await sessionFor(token);
  if (!session) return;
  await db.orm.public.Session.where({ id: session.id }).updateAll({ parentGateUntil: null, parentGateChallenge: null, parentGateAnswer: null });
}
