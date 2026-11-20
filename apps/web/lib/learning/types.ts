// Shapes shared by the student learning API and the player. Plain data only (safe for the browser).
// Nothing here may carry `isCorrect`, a weight, a score or a percentage.
import type { PublicInteraction } from "@/lib/watch/service";

export const PRESENTATION_STYLES = ["MORAL_CHOICE", "SITUATIONAL", "EMOTION", "PREDICT", "RATING"] as const;
export type PresentationStyle = (typeof PRESENTATION_STYLES)[number];

/** Everything the player page needs to play one module. Virtues are names only. */
export type StudentModuleData = {
  moduleId: number;
  title: string;
  videoUrl: string;
  duration: number;
  /** Clip credit, shown near the video for demo clips. */
  credit: string | null;
  virtues: string[];
  interactions: PublicInteraction[];
  /** Questions this child already answered (they are not asked again). */
  answeredIds: number[];
  /** Where playback starts (resume point, or 0). */
  resumeSeconds: number;
  completed: boolean;
};

export type SaveAnswerRequest = {
  interactionId: number;
  optionId?: number;
  text?: string;
  skip?: boolean;
  /** How long the question was on screen, not counting replays. */
  responseTimeMs: number;
  replayCount: number;
  positionSeconds: number;
  /** One key per answering attempt; a retry reuses it so nothing is counted twice. */
  idempotencyKey: string;
};

/** Neutral by design: a SURVEY reply says nothing about how "good" the choice was. Only a QUIZ reports `matched`. */
export type SaveAnswerReply = {
  type: "SURVEY" | "QUIZ" | "SKIPPED";
  matched?: boolean;
  next: { kind: "continue" };
};

export type ModuleRewards = {
  /** Stars earned by this story. */
  stars: number;
  totalStars: number;
  badges: { id: string; title: string }[];
  /** Virtue names that grew (no numbers). */
  grew: string[];
  followUpActivity: string;
  nextModule: { moduleId: number; title: string } | null;
  journey: { journeyId: number; title: string } | null;
};

export type PlayerLookup =
  | { status: "ok"; data: StudentModuleData }
  | { status: "locked"; title: string }
  | { status: "missing" };
