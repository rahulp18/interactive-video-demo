// Shapes of the adult-facing parent report. These carry scores, so they must never be imported by a child-facing page
// (tests/student-pages.test.ts guards the child loaders; this folder is excluded from that scan on purpose).
import type { Confidence, Quadrant, RatingMark, Trend } from "@/lib/scoring/types";
import type { VirtueSlug } from "@/lib/virtues/display";

export type ReportEvidence = {
  responseId: number;
  story: string;
  question: string;
  /** The text of the option the child chose (or what they typed). */
  answer: string;
  at: Date;
};

export type ReportVirtueRow = {
  virtueId: number;
  slug: VirtueSlug;
  name: string;
  composite: number | null;
  child: number | null;
  parent: number | null;
  teacher: number | null;
  confidence: Confidence;
  scoredInteractions: number;
  trend: Trend;
  trendDelta: number | null;
  series: { at: Date; score: number }[];
  parentMark: RatingMark;
  /** Parent and child views differ by at least the threat gap (rule threshold, not hard-coded here). */
  bigGap: boolean;
};

export type ReportSwotItem = {
  virtueId: number;
  slug: VirtueSlug;
  name: string;
  quadrant: Quadrant;
  /** Reworded for parents; the engine's own text is not shown. */
  reason: string;
  evidence: ReportEvidence[];
};

export type ReportStep = { moduleId: number; title: string; virtueName: string; completed: boolean; activity: string };
export type ExpertSuggestion = { virtueId: number; virtueName: string; categories: string[]; reason: string };

export type ParentInputRow = {
  virtueId: number;
  slug: VirtueSlug;
  name: string;
  latest: { rating: number; mark: RatingMark; notes: string | null } | null;
  previous: { rating: number; mark: RatingMark } | null;
  /** "Rating went from 3 to 4", ... or null when nothing changed. */
  change: string | null;
  teacherRating: number | null;
};

export type ParentReport = {
  child: { name: string; avatar: string | null; storiesFinished: number; lastActive: Date | null };
  ruleVersion: string;
  asOf: Date;
  disclaimer: string;
  summary: { dataSentence: string; strengthsSentence: string };
  virtues: ReportVirtueRow[];
  swot: { strengths: ReportSwotItem[]; weaknesses: ReportSwotItem[]; opportunities: ReportSwotItem[]; threats: ReportSwotItem[] };
  nextSteps: { stories: ReportStep[]; questions: { virtueName: string; question: string }[]; experts: ExpertSuggestion[] };
  parentInputs: { latestSetAt: Date | null; previousSetAt: Date | null; raterName: string | null; rows: ParentInputRow[] };
};

export type AuditEntry = { action: "REPORT_VIEW" | "REPORT_PRINT"; actorName: string; at: Date };
