// Shared by server validation and the browser editor. Nothing here may import server-only code.

export const INTERACTION_TYPES = ["SURVEY", "QUIZ"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const ANSWER_TYPES = ["CHOICE", "TEXT"] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];
export const isAnswerType = (v: unknown): v is AnswerType => v === "CHOICE" || v === "TEXT";

/**
 * How the student player draws a question (display only; stored on Interaction.presentationStyle). Every style is
 * answerType CHOICE; RATING is exactly 5 ordered options drawn as a slider.
 */
export const PRESENTATION_STYLES = ["MORAL_CHOICE", "SITUATIONAL", "EMOTION", "PREDICT", "RATING"] as const;
export type PresentationStyle = (typeof PRESENTATION_STYLES)[number];
export const isPresentationStyle = (v: unknown): v is PresentationStyle => PRESENTATION_STYLES.includes(v as PresentationStyle);
export const DEFAULT_PRESENTATION_STYLE: PresentationStyle = "MORAL_CHOICE";
export const PRESENTATION_STYLE_INFO: Record<PresentationStyle, { label: string; help: string }> = {
  MORAL_CHOICE: { label: "Moral choice", help: "What should a character do? Big picture cards." },
  SITUATIONAL: { label: "Situational", help: "What would YOU do in a similar everyday situation?" },
  EMOTION: { label: "Emotion", help: "Pick a feeling. Options are shown as a grid of faces." },
  PREDICT: { label: "Predict", help: "What happens next? Usually a quiz with one right answer." },
  RATING: { label: "Rating", help: "A 1-5 slider. Exactly 5 options, from lowest to highest." },
};
/** RATING is drawn as a five-step slider. */
export const RATING_OPTIONS = 5;

/** Virtue weight of one answer option: -2 (harmful) .. +2 (exemplary). 0 means "no row". */
export const WEIGHT_MIN = -2;
export const WEIGHT_MAX = 2;
export const WEIGHT_STEPS = [-2, -1, 0, 1, 2] as const;
/** virtueId -> non-zero weight. */
export type OptionWeights = Record<number, number>;

export const QUESTION_MAX = 500;
/** Longest free-text answer a viewer may submit. */
export const ANSWER_TEXT_MAX = 500;
export const CORRECT_ANSWER_MAX = 200;

/** How typed quiz answers are compared: case-, accent-form- and whitespace-insensitive. */
export const normalizeAnswer = (text: string): string => text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
export const OPTION_TEXT_MAX = 200;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 8;

/** `weights`: virtueId -> non-zero weight (every virtue with a row, not only the module's current ones). Teacher-only. */
export type OptionDTO = { id: number; text: string; isCorrect: boolean; position: number; weights: OptionWeights };
export type InteractionDTO = {
  id: number;
  videoId: number;
  timestamp: number;
  type: InteractionType;
  answerType: AnswerType;
  presentationStyle: PresentationStyle;
  question: string;
  /** TEXT quizzes only: the expected answer. */
  correctAnswer: string | null;
  isSkippable: boolean;
  position: number;
  options: OptionDTO[];
};

/**
 * `id` is set when an existing option is being edited, so its row (and any responses to it) is preserved.
 * `weights` (story modules only): the option's non-zero weights for the MODULE's virtues.
 */
export type OptionInput = { id?: number; text: string; isCorrect: boolean; weights?: OptionWeights };
export type InteractionInput = {
  type: InteractionType;
  answerType: AnswerType;
  presentationStyle: PresentationStyle;
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

/** The story module behind a video, as the editor needs it: primary virtue first, then the secondaries in order. */
export type EditorModuleVirtue = { id: number; slug: string; name: string; role: "primary" | "secondary" };
export type EditorModule = { moduleId: number; status: "DRAFT" | "PUBLISHED"; virtues: EditorModuleVirtue[] };

/** Context the SERVER derives (never the client): set when the video is a PARICHAY story module. */
export type InteractionContext = { moduleVirtueIds?: readonly number[] };

/**
 * Validates an interaction payload against the video's duration. Only named fields are copied out, so unknown
 * properties never reach the database layer. SURVEY options never carry a correct flag; a QUIZ has exactly one.
 * Story modules (`ctx.moduleVirtueIds`): CHOICE only (the student player cannot draw typed answers), a known style,
 * RATING has exactly 5 options, and option weights are -2..2 for the module's own virtues. Plain videos take no weights
 * and keep the default style.
 */
export function validateInteraction(body: unknown, duration: number, ctx: InteractionContext = {}): ValidationResult<InteractionInput> {
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

  const moduleVirtues = ctx.moduleVirtueIds ? new Set(ctx.moduleVirtueIds) : null;
  let presentationStyle: PresentationStyle = DEFAULT_PRESENTATION_STYLE;
  if (moduleVirtues) {
    if (answerType === "TEXT") errors.answerType = "Story modules use answer options: the student player cannot show typed answers.";
    if (raw.presentationStyle !== undefined) {
      if (isPresentationStyle(raw.presentationStyle)) presentationStyle = raw.presentationStyle;
      else errors.presentationStyle = "Unknown presentation style.";
    }
  }

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
      const weights = parseWeights(o.weights, moduleVirtues);
      if (typeof weights === "string") errors[`options.${i}.weights`] = weights;
      options.push({
        ...(typeof id === "number" && Number.isInteger(id) && id > 0 && { id }),
        text,
        isCorrect: type === "QUIZ" && o.isCorrect === true,
        ...(moduleVirtues && typeof weights === "object" && { weights }),
      });
    });
    if (!errors.options && moduleVirtues && presentationStyle === "RATING" && options.length !== RATING_OPTIONS) {
      errors.options = `A rating question has exactly ${RATING_OPTIONS} options, from lowest to highest.`;
    }
    const ids = options.flatMap((o) => (o.id === undefined ? [] : [o.id]));
    if (new Set(ids).size !== ids.length) errors.options = "Duplicate option ids.";
    if (!errors.options && type === "QUIZ" && options.filter((o) => o.isCorrect).length !== 1) {
      errors.options = "Mark exactly one option as the correct answer.";
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return {
    value: {
      type: type as InteractionType,
      answerType: answerType as AnswerType,
      presentationStyle,
      correctAnswer,
      timestamp,
      question,
      isSkippable: raw.isSkippable === true,
      options,
    },
  };
}

/**
 * An option's weights: a map virtueId -> integer -2..2 (keys may be numeric strings, as JSON object keys are). Zeros
 * are dropped (no row = no weight). Returns an error message instead when the input is not acceptable.
 */
function parseWeights(raw: unknown, moduleVirtues: ReadonlySet<number> | null): OptionWeights | string {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return "Weights must be an object of virtue id to weight.";
  const entries = Object.entries(raw as Record<string, unknown>);
  if (!moduleVirtues) return entries.length === 0 ? {} : "Only story modules have virtue weights.";
  const out: OptionWeights = {};
  for (const [key, value] of entries) {
    const virtueId = /^\d{1,10}$/.test(key) ? Number(key) : NaN;
    if (!moduleVirtues.has(virtueId)) return "Weights can only use this module's virtues.";
    if (typeof value !== "number" || !Number.isInteger(value) || value < WEIGHT_MIN || value > WEIGHT_MAX) {
      return `Weights must be whole numbers from ${WEIGHT_MIN} to ${WEIGHT_MAX}.`;
    }
    if (value !== 0) out[virtueId] = value;
  }
  return out;
}

/** True when at least one option of the question weighs a virtue (a question without weights scores nothing). */
export const hasWeights = (options: readonly { weights: OptionWeights }[]): boolean => options.some((o) => Object.keys(o.weights).length > 0);
