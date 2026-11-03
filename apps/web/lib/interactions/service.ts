import "server-only";
import { db } from "@/prisma/db";
import { AuthError } from "@/lib/auth/errors";
import { getVideo } from "@/lib/videos/service";
import {
  sortInteractions,
  type AnswerType,
  validateInteraction,
  type InteractionDTO,
  type InteractionType,
} from "./model";

type OptionRow = { id: number; text: string; isCorrect: boolean; position: number };
type InteractionRow = {
  id: number;
  videoId: number;
  timestamp: number;
  type: string;
  answerType: string;
  correctAnswer: string | null;
  question: string;
  isSkippable: boolean;
  position: number;
  options: OptionRow[];
};

const toDTO = (r: InteractionRow): InteractionDTO => ({
  id: r.id,
  videoId: r.videoId,
  timestamp: r.timestamp,
  type: r.type as InteractionType,
  answerType: r.answerType as AnswerType,
  correctAnswer: r.correctAnswer,
  question: r.question,
  isSkippable: r.isSkippable,
  position: r.position,
  options: [...r.options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, position: o.position })),
});

// Postgres foreign_key_violation (SQLSTATE 23503): an option that already has responses cannot be removed.
function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("sqlState" in error && error.sqlState === "23503") return true;
  return "cause" in error && isForeignKeyViolation(error.cause);
}

const validationError = (errors: Record<string, string>) => new AuthError("VALIDATION_ERROR", "Invalid request.", errors);

/** Interactions of a video the caller owns (ownership is checked first), sorted by timestamp. */
export async function listVideoInteractions(userId: number, videoId: number): Promise<InteractionDTO[]> {
  await getVideo(userId, videoId);
  const rows = await db.orm.public.Interaction.where({ videoId }).include("options").all();
  return sortInteractions(rows.map(toDTO));
}

async function readInteraction(videoId: number, id: number): Promise<InteractionDTO> {
  const row = await db.orm.public.Interaction.where({ id, videoId }).include("options").first();
  if (!row) throw new AuthError("NOT_FOUND", "Interaction not found.");
  return toDTO(row);
}

export async function createInteraction(userId: number, videoId: number, body: unknown): Promise<InteractionDTO> {
  const video = await getVideo(userId, videoId);
  const parsed = validateInteraction(body, video.duration);
  if (parsed.errors) throw validationError(parsed.errors);
  const input = parsed.value;
  if (input.options.some((o) => o.id !== undefined)) {
    throw validationError({ options: "New interactions cannot reference existing options." });
  }

  const id = await db.transaction(async (tx) => {
    // Position orders interactions that share a timestamp.
    const tied = await tx.orm.public.Interaction.where({ videoId, timestamp: input.timestamp }).all();
    const created = await tx.orm.public.Interaction.create({
      videoId,
      timestamp: input.timestamp,
      type: input.type,
      answerType: input.answerType,
      correctAnswer: input.correctAnswer,
      question: input.question,
      isSkippable: input.isSkippable,
      position: tied.length,
    });
    if (input.options.length > 0) {
      await tx.orm.public.InteractionOption.createAll(
        input.options.map((o, position) => ({ interactionId: created.id, text: o.text, isCorrect: o.isCorrect, position })),
      );
    }
    return created.id;
  });
  return readInteraction(videoId, id);
}

/**
 * Replaces an interaction's configuration. Options sent with an `id` are updated in place (so rows that responses
 * point at survive), options without one are created, and existing options that are not sent are deleted.
 */
export async function updateInteraction(
  userId: number,
  videoId: number,
  interactionId: number,
  body: unknown,
): Promise<InteractionDTO> {
  const video = await getVideo(userId, videoId);
  const parsed = validateInteraction(body, video.duration);
  if (parsed.errors) throw validationError(parsed.errors);
  const input = parsed.value;

  const existing = await db.orm.public.Interaction.where({ id: interactionId, videoId }).include("options").first();
  if (!existing) throw new AuthError("NOT_FOUND", "Interaction not found.");

  const existingIds = new Set(existing.options.map((o) => o.id));
  if (input.options.some((o) => o.id !== undefined && !existingIds.has(o.id))) {
    throw validationError({ options: "Option does not belong to this interaction." });
  }
  const keptIds = new Set(input.options.flatMap((o) => (o.id === undefined ? [] : [o.id])));
  const removedIds = existing.options.filter((o) => !keptIds.has(o.id)).map((o) => o.id);

  let position = existing.position;
  if (existing.timestamp !== input.timestamp) {
    const tied = await db.orm.public.Interaction.where({ videoId, timestamp: input.timestamp }).all();
    position = tied.length;
  }

  try {
    await db.transaction(async (tx) => {
      await tx.orm.public.Interaction.where({ id: interactionId, videoId }).updateAll({
        timestamp: input.timestamp,
        type: input.type,
        answerType: input.answerType,
        correctAnswer: input.correctAnswer,
        question: input.question,
        isSkippable: input.isSkippable,
        position,
      });
      if (removedIds.length > 0) {
        await tx.orm.public.InteractionOption.where((o) => o.id.in(removedIds)).deleteAll();
      }
      // (interactionId, position) is unique: park kept options out of the way before assigning final positions.
      const PARK = 1_000_000;
      for (const o of existing.options.filter((o) => keptIds.has(o.id))) {
        await tx.orm.public.InteractionOption.where({ id: o.id }).updateAll({ position: PARK + o.position });
      }
      for (const [index, o] of input.options.entries()) {
        if (o.id !== undefined) {
          await tx.orm.public.InteractionOption.where({ id: o.id }).updateAll({
            text: o.text,
            isCorrect: o.isCorrect,
            position: index,
          });
        }
      }
      const added = input.options.flatMap((o, index) => (o.id === undefined ? [{ o, index }] : []));
      if (added.length > 0) {
        await tx.orm.public.InteractionOption.createAll(
          added.map(({ o, index }) => ({ interactionId, text: o.text, isCorrect: o.isCorrect, position: index })),
        );
      }
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new AuthError("CONFLICT", "An answer option that already has responses cannot be removed.");
    }
    throw error;
  }
  return readInteraction(videoId, interactionId);
}

export async function deleteInteraction(userId: number, videoId: number, interactionId: number): Promise<void> {
  await getVideo(userId, videoId);
  const deleted = await db.orm.public.Interaction.where({ id: interactionId, videoId }).delete();
  if (!deleted) throw new AuthError("NOT_FOUND", "Interaction not found.");
}

export type InteractionFilter = { type?: InteractionType; q?: string; videoId?: number };
export type VideoInteractionGroup = {
  video: { id: number; title: string; duration: number };
  interactions: InteractionDTO[];
};

/**
 * The caller's interactions grouped by video (newest video first, interactions by timestamp). A view over existing
 * rows: there are no standalone survey or quiz models. Videos with no matching interaction are omitted.
 */
export async function listInteractionsByVideo(userId: number, filter: InteractionFilter = {}): Promise<VideoInteractionGroup[]> {
  const q = filter.q?.trim().toLowerCase();
  const rows = await db.orm.public.Video.where({ uploaderId: userId })
    .orderBy([(v) => v.createdAt.desc(), (v) => v.id.desc()])
    .include("interactions", (i) => i.include("options"))
    .all();

  return rows
    .filter((v) => filter.videoId === undefined || v.id === filter.videoId)
    .map((v) => ({
      video: { id: v.id, title: v.title, duration: v.duration },
      interactions: sortInteractions(
        v.interactions
          .filter((i) => !filter.type || i.type === filter.type)
          .filter((i) => !q || i.question.toLowerCase().includes(q))
          .map(toDTO),
      ),
    }))
    .filter((g) => g.interactions.length > 0);
}
