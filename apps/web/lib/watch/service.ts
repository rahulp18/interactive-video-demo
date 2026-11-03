import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/prisma/db";
import { AuthError } from "@/lib/auth/errors";
import { isUniqueViolation } from "@/lib/auth/service";
import { getVideo } from "@/lib/videos/service";
import { ANSWER_TEXT_MAX, normalizeAnswer, sortInteractions, type AnswerType, type InteractionType } from "@/lib/interactions/model";

/** 12 random bytes -> 16 url-safe characters (96 bits): not guessable or enumerable. */
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
export const isShareId = (value: string) => SHARE_ID_PATTERN.test(value);

const newShareId = () => randomBytes(12).toString("base64url");

/** Turns the public link on (idempotent: an existing link is kept) and returns its token. Owner only. */
export async function enableSharing(userId: number, videoId: number): Promise<string> {
  const video = await getVideo(userId, videoId);
  if (video.shareId) return video.shareId;
  await db.orm.public.Video.where({ id: videoId, uploaderId: userId })
    .where((v) => v.shareId.isNull())
    .updateAll({ shareId: newShareId() });
  // Re-read so two concurrent enables agree on the winner's token.
  const after = await getVideo(userId, videoId);
  if (!after.shareId) throw new AuthError("INTERNAL_ERROR", "Could not create the link.");
  return after.shareId;
}

/** Revokes the public link immediately; enabling again issues a different token. Owner only. */
export async function disableSharing(userId: number, videoId: number): Promise<void> {
  await getVideo(userId, videoId);
  await db.orm.public.Video.where({ id: videoId, uploaderId: userId }).updateAll({ shareId: null, isListed: false });
}

/** Lists or unlists the video in the platform Library (listing needs a public link, which it creates if missing). */
export async function setListed(userId: number, videoId: number, listed: boolean): Promise<{ shareId: string | null; isListed: boolean }> {
  const shareId = listed ? await enableSharing(userId, videoId) : (await getVideo(userId, videoId)).shareId;
  await db.orm.public.Video.where({ id: videoId, uploaderId: userId }).updateAll({ isListed: listed });
  return { shareId, isListed: listed };
}

export type LibraryItem = {
  shareId: string;
  title: string;
  fileUrl: string;
  duration: number;
  createdAt: string;
  author: string;
  interactionCount: number;
};

/** Videos their owners listed in the Library, newest first. Only listed videos with a live link are ever returned. */
export async function listLibrary(): Promise<LibraryItem[]> {
  const rows = await db.orm.public.Video.where({ isListed: true })
    .where((v) => v.shareId.isNotNull())
    .orderBy([(v) => v.createdAt.desc(), (v) => v.id.desc()])
    .include("uploader", (u) => u.select("name"))
    .include("interactions", (i) => i.count())
    .all();
  return rows.flatMap((v) =>
    v.shareId
      ? [{ shareId: v.shareId, title: v.title, fileUrl: v.fileUrl, duration: v.duration, createdAt: v.createdAt.toISOString(), author: v.uploader?.name ?? "Unknown", interactionCount: v.interactions }]
      : [],
  );
}

/** Interactions this signed-in viewer already answered or skipped on a shared video, so they are not asked twice. */
export async function getViewerAnsweredIds(userId: number, shareId: string): Promise<number[]> {
  if (!isShareId(shareId)) return [];
  const video = await db.orm.public.Video.where({ shareId }).first();
  if (!video) return [];
  const interactions = await db.orm.public.Interaction.where({ videoId: video.id }).all();
  if (interactions.length === 0) return [];
  const ids = interactions.map((i) => i.id);
  const mine = await db.orm.public.InteractionResponse.where({ userId }).where((r) => r.interactionId.in(ids)).all();
  return mine.map((r) => r.interactionId);
}

/** What a viewer may see. Deliberately has no `isCorrect`, no uploader and no file metadata beyond playback. */
export type PublicInteraction = {
  id: number;
  timestamp: number;
  type: InteractionType;
  answerType: AnswerType;
  question: string;
  isSkippable: boolean;
  /** Empty for TEXT interactions. */
  options: { id: number; text: string }[];
};
export type PublicVideo = { title: string; fileUrl: string; duration: number; interactions: PublicInteraction[] };

export async function getPublicVideo(shareId: string): Promise<PublicVideo | null> {
  if (!isShareId(shareId)) return null;
  const video = await db.orm.public.Video.where({ shareId }).first();
  if (!video) return null;
  const rows = await db.orm.public.Interaction.where({ videoId: video.id }).include("options").all();
  const interactions = sortInteractions(rows).map((i) => ({
    id: i.id,
    timestamp: i.timestamp,
    type: i.type as InteractionType,
    answerType: i.answerType as AnswerType,
    question: i.question,
    isSkippable: i.isSkippable,
    options: [...i.options].sort((a, b) => a.position - b.position).map((o) => ({ id: o.id, text: o.text })),
  }));
  return { title: video.title, fileUrl: video.fileUrl, duration: video.duration, interactions };
}

export type AnswerResult =
  | { type: "SURVEY" }
  | { type: "SKIPPED" }
  | { type: "QUIZ"; correct: boolean; correctOptionId: number | null; correctAnswer: string | null };

/**
 * Validates a viewer's answer against the shared video's own interaction and, for quizzes, reveals correctness only
 * now (never before an answer is given). Choice questions take `{ optionId }`, text questions `{ text }`, and
 * `{ skip: true }` is accepted only for skippable interactions. Signed-in viewers' answers are stored once per
 * interaction (the first answer stands, so a replay cannot rewrite results); anonymous answers are graded, not stored.
 */
export async function checkPublicAnswer(shareId: string, interactionId: number, body: unknown, viewerId: number | null = null): Promise<AnswerResult> {
  const notFound = new AuthError("NOT_FOUND", "Not found.");
  if (!isShareId(shareId)) throw notFound;
  const video = await db.orm.public.Video.where({ shareId }).first();
  if (!video) throw notFound;
  const interaction = await db.orm.public.Interaction.where({ id: interactionId, videoId: video.id }).include("options").first();
  if (!interaction) throw notFound;

  const raw = typeof body === "object" && body !== null ? (body as { optionId?: unknown; text?: unknown; skip?: unknown }) : {};
  const store = async (answer: { selectedOptionId: number } | { textAnswer: string } | null) => {
    if (viewerId === null) return;
    try {
      await db.orm.public.InteractionResponse.create({
        userId: viewerId,
        interactionId,
        selectedOptionId: answer && "selectedOptionId" in answer ? answer.selectedOptionId : null,
        textAnswer: answer && "textAnswer" in answer ? answer.textAnswer : null,
        isSkipped: answer === null,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error; // already answered: keep the first response
    }
  };

  if (raw.skip === true) {
    if (!interaction.isSkippable) throw new AuthError("VALIDATION_ERROR", "Invalid request.", { skip: "This question cannot be skipped." });
    await store(null);
    return { type: "SKIPPED" };
  }

  if (interaction.answerType === "TEXT") {
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text || text.length > ANSWER_TEXT_MAX) {
      throw new AuthError("VALIDATION_ERROR", "Invalid request.", { text: `Enter an answer of up to ${ANSWER_TEXT_MAX} characters.` });
    }
    await store({ textAnswer: text });
    if (interaction.type !== "QUIZ") return { type: "SURVEY" };
    if (!interaction.correctAnswer) throw new AuthError("INTERNAL_ERROR", "This quiz has no correct answer configured.");
    return { type: "QUIZ", correct: normalizeAnswer(text) === normalizeAnswer(interaction.correctAnswer), correctOptionId: null, correctAnswer: interaction.correctAnswer };
  }

  const option = typeof raw.optionId === "number" ? interaction.options.find((o) => o.id === raw.optionId) : undefined;
  if (!option) throw new AuthError("VALIDATION_ERROR", "Invalid request.", { optionId: "Choose one of the options." });
  await store({ selectedOptionId: option.id });

  if (interaction.type !== "QUIZ") return { type: "SURVEY" };
  const correct = interaction.options.find((o) => o.isCorrect);
  if (!correct) throw new AuthError("INTERNAL_ERROR", "This quiz has no correct answer configured.");
  return { type: "QUIZ", correct: option.id === correct.id, correctOptionId: correct.id, correctAnswer: null };
}
