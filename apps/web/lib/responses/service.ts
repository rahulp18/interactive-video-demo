import "server-only";
import { db } from "@/prisma/db";
import { getVideo, listVideos } from "@/lib/videos/service";
import { normalizeAnswer, sortInteractions, type AnswerType, type InteractionType } from "@/lib/interactions/model";

export type OptionStat = { id: number; text: string; count: number; isCorrect: boolean };
export type InteractionStat = {
  id: number;
  timestamp: number;
  type: InteractionType;
  answerType: AnswerType;
  question: string;
  isSkippable: boolean;
  /** TEXT quizzes: the expected answer. */
  correctAnswer: string | null;
  /** TEXT questions: every typed answer, with who gave it (and whether it was right for a quiz). */
  textAnswers: { text: string; name: string; correct: boolean | null }[];
  /** Viewers who gave an answer (picked an option or typed text). */
  answered: number;
  skipped: number;
  /** Quiz only: share of answers that were correct (0..1), null when nobody answered. */
  correctRate: number | null;
  options: OptionStat[];
};
export type RespondentAnswer = { optionId: number | null; text: string | null; skipped: boolean; correct: boolean | null; at: string };
export type Respondent = {
  userId: number;
  name: string;
  email: string;
  answered: number;
  skipped: number;
  correct: number;
  lastActivity: string;
  answers: Record<number, RespondentAnswer>;
};
export type ResponseSummary = {
  video: { id: number; title: string; duration: number };
  respondentCount: number;
  totalResponses: number;
  interactions: InteractionStat[];
  respondents: Respondent[];
};

/**
 * Results for one video the caller owns: per-question tallies and every identified respondent. Ownership is checked
 * first (NOT_FOUND otherwise); respondents' passwords and sessions are never selected.
 */
export async function getResponseSummary(userId: number, videoId: number): Promise<ResponseSummary> {
  const video = await getVideo(userId, videoId);
  const rows = sortInteractions(await db.orm.public.Interaction.where({ videoId }).include("options").all());
  const ids = rows.map((i) => i.id);
  const responses =
    ids.length === 0
      ? []
      : await db.orm.public.InteractionResponse.where((r) => r.interactionId.in(ids))
          .include("user", (u) => u.select("id", "name", "email"))
          .all();

  const optionOf = new Map(rows.flatMap((i) => i.options.map((o) => [o.id, o] as const)));
  const byInteraction = new Map<number, typeof responses>();
  for (const r of responses) byInteraction.set(r.interactionId, [...(byInteraction.get(r.interactionId) ?? []), r]);

  const interactions: InteractionStat[] = rows.map((i) => {
    const rs = byInteraction.get(i.id) ?? [];
    const answered = rs.filter((r) => !r.isSkipped).length;
    const isText = i.answerType === "TEXT";
    const matches = (t: string) => i.correctAnswer !== null && normalizeAnswer(t) === normalizeAnswer(i.correctAnswer);
    const textAnswers = rs.flatMap((r) =>
      r.textAnswer === null ? [] : [{ text: r.textAnswer, name: r.user?.name ?? "Unknown", correct: i.type === "QUIZ" ? matches(r.textAnswer) : null }],
    );
    const options = [...i.options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, count: rs.filter((r) => r.selectedOptionId === o.id).length }));
    const correctCount = isText ? textAnswers.filter((a) => a.correct).length : options.filter((o) => o.isCorrect).reduce((n, o) => n + o.count, 0);
    return {
      id: i.id,
      timestamp: i.timestamp,
      type: i.type as InteractionType,
      answerType: i.answerType as AnswerType,
      question: i.question,
      isSkippable: i.isSkippable,
      correctAnswer: i.correctAnswer,
      textAnswers,
      answered,
      skipped: rs.length - answered,
      correctRate: i.type === "QUIZ" && answered > 0 ? correctCount / answered : null,
      options,
    };
  });

  const people = new Map<number, Respondent>();
  for (const r of responses) {
    if (!r.user) continue;
    const person =
      people.get(r.userId) ??
      { userId: r.userId, name: r.user.name, email: r.user.email, answered: 0, skipped: 0, correct: 0, lastActivity: "", answers: {} };
    const option = r.selectedOptionId === null ? undefined : optionOf.get(r.selectedOptionId);
    const row = rows.find((i) => i.id === r.interactionId);
    const quiz = row?.type === "QUIZ";
    const at = r.createdAt.toISOString();
    const correct =
      !quiz || r.isSkipped
        ? null
        : r.textAnswer !== null
          ? row?.correctAnswer != null && normalizeAnswer(r.textAnswer) === normalizeAnswer(row.correctAnswer)
          : (option?.isCorrect ?? null);
    person.answers[r.interactionId] = { optionId: r.selectedOptionId, text: r.textAnswer, skipped: r.isSkipped, correct, at };
    if (r.isSkipped) person.skipped++;
    else person.answered++;
    if (correct === true) person.correct++;
    if (at > person.lastActivity) person.lastActivity = at;
    people.set(r.userId, person);
  }

  return {
    video: { id: video.id, title: video.title, duration: video.duration },
    respondentCount: people.size,
    totalResponses: responses.length,
    interactions,
    respondents: [...people.values()].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)),
  };
}

export type ResponseOverviewItem = { id: number; title: string; duration: number; interactionCount: number; respondentCount: number; responseCount: number; isShared: boolean };

/** One row per video the caller owns, with how many distinct people responded. */
export async function getResponseOverview(userId: number): Promise<ResponseOverviewItem[]> {
  const videos = await listVideos(userId);
  const ids = videos.map((v) => v.id);
  const interactions = ids.length === 0 ? [] : await db.orm.public.Interaction.where((i) => i.videoId.in(ids)).all();
  const videoOf = new Map(interactions.map((i) => [i.id, i.videoId]));
  const responses = interactions.length === 0 ? [] : await db.orm.public.InteractionResponse.where((r) => r.interactionId.in([...videoOf.keys()])).all();
  const people = new Map<number, Set<number>>();
  const counts = new Map<number, number>();
  for (const r of responses) {
    const v = videoOf.get(r.interactionId);
    if (v === undefined) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    people.set(v, (people.get(v) ?? new Set()).add(r.userId));
  }
  return videos.map((v) => ({
    id: v.id,
    title: v.title,
    duration: v.duration,
    interactionCount: v.interactionCount,
    respondentCount: people.get(v.id)?.size ?? 0,
    responseCount: counts.get(v.id) ?? 0,
    isShared: v.shareId !== null,
  }));
}

/** Escapes a CSV cell and neutralises spreadsheet formulas ("=", "+", "-", "@" prefixes) in user-controlled text. */
const cell = (value: string | number | boolean | null) => {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** One row per respondent x interaction answered, for spreadsheets. */
export function responsesToCsv(summary: ResponseSummary): string {
  const header = ["Name", "Email", "Timestamp (s)", "Type", "Question", "Answer", "Skipped", "Correct", "Answered at"];
  const lines = [header.map(cell).join(",")];
  for (const p of summary.respondents) {
    for (const i of summary.interactions) {
      const a = p.answers[i.id];
      if (!a) continue;
      const answer = a.text ?? i.options.find((o) => o.id === a.optionId)?.text ?? "";
      lines.push([p.name, p.email, i.timestamp, i.type, i.question, answer, a.skipped, a.correct, a.at].map(cell).join(","));
    }
  }
  return lines.join("\r\n") + "\r\n";
}
