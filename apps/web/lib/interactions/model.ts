// Shared by server validation and the browser editor. Nothing here may import server-only code.

export const INTERACTION_TYPES = ["SURVEY", "QUIZ"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const ANSWER_TYPES = ["CHOICE", "TEXT"] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];
export const isAnswerType = (v: unknown): v is AnswerType => v === "CHOICE" || v === "TEXT";

export const QUESTION_MAX = 500;
/** Longest free-text answer a viewer may submit. */
export const ANSWER_TEXT_MAX = 500;
export const CORRECT_ANSWER_MAX = 200;

/** How typed quiz answers are compared: case-, accent-form- and whitespace-insensitive. */
export const normalizeAnswer = (text: string): string => text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export const OPTION_TEXT_MAX = 200;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 8;

export type OptionDTO = { id: number; text: string; isCorrect: boolean; position: number };
export type InteractionDTO = {
  id: number;
  videoId: number;
  timestamp: number;
  type: InteractionType;
  answerType: AnswerType;
  question: string;
  /** TEXT quizzes only: the expected answer. */
  correctAnswer: string | null;
  isSkippable: boolean;
  position: number;
  options: OptionDTO[];
};

/** `id` is set when an existing option is being edited, so its row (and any responses to it) is preserved. */
export type OptionInput = { id?: number; text: string; isCorrect: boolean };
export type InteractionInput = {
  type: InteractionType;
  answerType: AnswerType;
  correctAnswer: string | null;
  timestamp: number;
  question: string;
  isSkippable: boolean;
  options: OptionInput[];
};

export type ValidationResult<T> = { value: T; errors?: undefined } | { value?: undefined; errors: Record<string, string> };

export const isInteractionType = (v: unknown): v is InteractionType => v === "SURVEY" || v === "QUIZ";

/** Timestamps are stored with 0.1s precision. */
export const roundTimestamp = (seconds: number): number => Math.round(seconds * 10) / 10;

export function sortInteractions<T extends { timestamp: number; position: number; id: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.timestamp - b.timestamp || a.position - b.position || a.id - b.id);
}

/** "1:05.5" -> 65.5, "1:02:03" -> 3723, "75" / "75.5" -> seconds. Returns null when it is not a valid time. */
export function parseTimestamp(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  const parts = text.split(":");
  if (parts.length > 3) return null;
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    if (!(isLast ? /^\d+(\.\d+)?$/ : /^\d+$/).test(part)) return null;
    total = total * 60 + Number(part);
  }
  return Number.isFinite(total) ? total : null;
}

/** 65.5 -> "1:05.5". One decimal so a manually entered time round-trips. */
export function formatPreciseTimestamp(seconds: number): string {
  const safe = Math.max(0, roundTimestamp(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = (safe % 60).toFixed(1).padStart(4, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Validates an interaction payload against the video's duration. Only named fields are copied out, so unknown
 * properties never reach the database layer. SURVEY options never carry a correct flag; a QUIZ has exactly one.
 */
export function validateInteraction(body: unknown, duration: number): ValidationResult<InteractionInput> {
  const errors: Record<string, string> = {};
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { errors: { _: "Request body must be a JSON object." } };
  }
  const raw = body as Record<string, unknown>;

  const type = raw.type;
  if (!isInteractionType(type)) errors.type = "Type must be SURVEY or QUIZ.";

  let timestamp = 0;
  if (typeof raw.timestamp !== "number" || !Number.isFinite(raw.timestamp)) {
    errors.timestamp = "A valid timestamp is required.";
  } else {
    timestamp = roundTimestamp(raw.timestamp);
    if (timestamp < 0 || timestamp > duration) {
      errors.timestamp = `Timestamp must be between 0 and ${formatPreciseTimestamp(duration)}.`;
    }
  }

  const question = typeof raw.question === "string" ? raw.question.trim() : "";
  if (!question) errors.question = "Question is required.";
  else if (question.length > QUESTION_MAX) errors.question = `Question must be at most ${QUESTION_MAX} characters.`;

  if (raw.isSkippable !== undefined && typeof raw.isSkippable !== "boolean") errors.isSkippable = "Must be true or false.";

  const answerType = raw.answerType === undefined ? "CHOICE" : raw.answerType;
  if (!isAnswerType(answerType)) errors.answerType = "Answer type must be CHOICE or TEXT.";

  const options: OptionInput[] = [];
  let correctAnswer: string | null = null;
  if (answerType === "TEXT") {
    // Typed answers have no options; a quiz needs the expected answer to check against.
    if (Array.isArray(raw.options) && raw.options.length > 0) errors.options = "Text questions do not have answer options.";
    if (type === "QUIZ") {
      const expected = typeof raw.correctAnswer === "string" ? raw.correctAnswer.trim().replace(/\s+/g, " ") : "";
      if (!expected) errors.correctAnswer = "Enter the correct answer.";
      else if (expected.length > CORRECT_ANSWER_MAX) errors.correctAnswer = `Correct answer must be at most ${CORRECT_ANSWER_MAX} characters.`;
      else correctAnswer = expected;
    }
  } else if (!Array.isArray(raw.options)) {
    errors.options = "Options must be a list.";
  } else if (raw.options.length < OPTIONS_MIN || raw.options.length > OPTIONS_MAX) {
    errors.options = `Provide ${OPTIONS_MIN}-${OPTIONS_MAX} answer options.`;
  } else {
    raw.options.forEach((item, i) => {
      const o = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      const text = typeof o.text === "string" ? o.text.trim() : "";
      if (!text) errors[`options.${i}`] = "Option text is required.";
      else if (text.length > OPTION_TEXT_MAX) errors[`options.${i}`] = `Option must be at most ${OPTION_TEXT_MAX} characters.`;
      const id = o.id;
      if (id !== undefined && id !== null && (typeof id !== "number" || !Number.isInteger(id) || id <= 0)) {
        errors[`options.${i}`] = "Invalid option id.";
      }
      options.push({
        ...(typeof id === "number" && Number.isInteger(id) && id > 0 && { id }),
        text,
        isCorrect: type === "QUIZ" && o.isCorrect === true,
      });
    });
    const ids = options.flatMap((o) => (o.id === undefined ? [] : [o.id]));
    if (new Set(ids).size !== ids.length) errors.options = "Duplicate option ids.";
    if (!errors.options && type === "QUIZ" && options.filter((o) => o.isCorrect).length !== 1) {
      errors.options = "Mark exactly one option as the correct answer.";
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return {
    value: { type: type as InteractionType, answerType: answerType as AnswerType, correctAnswer, timestamp, question, isSkippable: raw.isSkippable === true, options },
  };
}
