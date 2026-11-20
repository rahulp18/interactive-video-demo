import "server-only";
import type { db } from "@/prisma/db";
import { isUniqueViolation } from "@/lib/auth/service";

export type StoredAnswer = { selectedOptionId: number } | { textAnswer: string } | null;

export type ResponseCapture = {
  responseTimeMs?: number;
  replayCount?: number;
  /** Client idempotency key. A retry carrying the key already stored on the row changes nothing. */
  requestId?: string;
};

/** Anything with the ORM: the client itself or a transaction handed out by `db.transaction`. */
type OrmClient = Pick<typeof db, "orm">;

/**
 * The ONE place an answer is written, shared by `/watch` and the student player. There is a single row per user and
 * interaction holding the latest answer; a real re-answer replaces it and counts one more attempt. A repeat of the
 * same `requestId` is a no-op that reports the same attempt. Does not catch the unique violation of two simultaneous
 * first answers: wrap the call (or its transaction) in `retryOnUniqueViolation`.
 */
export async function recordResponse(
  client: OrmClient,
  args: { userId: number; interactionId: number; answer: StoredAnswer; capture?: ResponseCapture },
): Promise<{ attemptCount: number; duplicate: boolean }> {
  const { userId, interactionId, answer, capture = {} } = args;
  const responses = client.orm.public.InteractionResponse;
  const existing = await responses.where({ userId, interactionId }).first();

  const answerData = {
    selectedOptionId: answer && "selectedOptionId" in answer ? answer.selectedOptionId : null,
    textAnswer: answer && "textAnswer" in answer ? answer.textAnswer : null,
    isSkipped: answer === null,
  };

  if (!existing) {
    await responses.create({
      userId,
      interactionId,
      ...answerData,
      responseTimeMs: capture.responseTimeMs ?? null,
      replayCount: capture.replayCount ?? 0,
      attemptCount: 1,
      lastRequestId: capture.requestId ?? null,
    });
    return { attemptCount: 1, duplicate: false };
  }
  if (capture.requestId && existing.lastRequestId === capture.requestId) return { attemptCount: existing.attemptCount, duplicate: true };

  const attemptCount = existing.attemptCount + 1;
  await responses.where({ userId, interactionId }).updateAll({
    ...answerData,
    attemptCount,
    lastRequestId: capture.requestId ?? null,
    // Callers that capture nothing (the public /watch path) keep what an earlier attempt captured.
    ...(capture.responseTimeMs !== undefined && { responseTimeMs: capture.responseTimeMs }),
    ...(capture.replayCount !== undefined && { replayCount: capture.replayCount }),
  });
  return { attemptCount, duplicate: false };
}

/**
 * Runs `fn`, and once more if it hit a unique violation. Two simultaneous first answers (or first progress rows) race
 * on the unique key; the second attempt then sees the row the winner wrote and takes the update path.
 */
export async function retryOnUniqueViolation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return fn();
  }
}
