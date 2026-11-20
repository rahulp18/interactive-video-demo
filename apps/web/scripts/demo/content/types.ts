// Shape of the PARICHAY demo content. Plain data: a content reviewer can read the story files without reading code.

export type VirtueSlug =
  | "self-discipline"
  | "compassion"
  | "responsibility"
  | "friendship"
  | "work"
  | "courage"
  | "perseverance"
  | "honesty"
  | "loyalty"
  | "faith";

export type PresentationStyle = "MORAL_CHOICE" | "SITUATIONAL" | "EMOTION" | "PREDICT" | "RATING";

/** How an option scores. good = the clearly good choice, neutral = no weight rows at all, poor = a gentle -1/-2. */
export type Tone = "good" | "neutral" | "poor";

export type OptionDef = {
  text: string;
  /** Only for non-RATING questions; the demo history picks options by tone ("g", "n", "p"). RATING picks by index "0".."4". */
  tone?: Tone;
  /** virtue -> weight (-2..+2, never 0). No entry = this option is neutral for that virtue. At most 2 virtues per option. */
  w?: Partial<Record<VirtueSlug, number>>;
};

export type QuestionDef = {
  /** Where the question appears, as a fraction (0..1) of the clip's duration, so swapping the clip needs no edits here. */
  at: number;
  style: PresentationStyle;
  question: string;
  /** Default SURVEY (no right answer). */
  type?: "SURVEY" | "QUIZ";
  options: OptionDef[];
  /** QUIZ only: index of the correct option. */
  correct?: number;
};

export type ModuleDef = {
  /** Stable key: Video.fileKey is `demo:<slug>`. */
  slug: string;
  title: string;
  /** "Title (collection)" - stored in Module.sourceStory. */
  sourceStory: string;
  clip: string;
  primary: VirtueSlug;
  secondary: VirtueSlug[];
  ageBand: "8-9" | "10-12";
  /** One sentence. */
  learningObjective: string;
  /** Narration of the story as it would be told in the real video (reviewer documentation; not stored in the DB). */
  script: string;
  /** 2-3 questions for a parent or teacher. */
  discussionPrompts: string[];
  /** One small real-world activity. */
  followUp: string;
  questions: QuestionDef[];
};

export type JourneyDef = {
  title: string;
  description: string;
  focus: VirtueSlug;
  displayOrder: number;
  /** level (1-based), modules in order within the level. */
  levels: string[][];
};

export type ClipDef = {
  id: string;
  title: string;
  url: string;
  mimeType: string;
  /** Seconds. */
  duration: number;
  /** Approximate size in bytes (informational). */
  sizeBytes: number;
  licence: string;
  attribution: string;
};

/** The five labels of every RATING question, in order. */
export const RATING_LABELS = ["Not at all like me", "A little like me", "Sometimes like me", "Mostly like me", "Very much like me"] as const;

/**
 * Builds the 5 options of a RATING question. `w` gives the weights of option 0 (not at all), 1, 3 and 4 (very much);
 * option 2 ("sometimes") is always neutral.
 */
export function rating(w: [OptionDef["w"], OptionDef["w"], OptionDef["w"], OptionDef["w"]]): OptionDef[] {
  return RATING_LABELS.map((text, i) => ({ text, w: i === 2 ? undefined : w[i < 2 ? i : i - 1] }));
}
