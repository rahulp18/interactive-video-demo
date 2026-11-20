// Small shared helpers for the parent report. Dates are formatted on the server in a fixed zone so server and browser agree.
import type { Confidence } from "@/lib/scoring/types";

export const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  insufficient: "Not enough data yet",
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

// Series styling: colour AND pattern AND marker, so the three views can be told apart without colour (Okabe-Ito hues).
export const SERIES = {
  composite: { label: "Overall", color: "currentColor", dash: undefined, marker: "circle" },
  child: { label: "Child", color: "#0072B2", dash: undefined, marker: "circle" },
  parent: { label: "Parent", color: "#D55E00", dash: "6 4", marker: "square" },
  teacher: { label: "Teacher", color: "#009E73", dash: "2 4", marker: "triangle" },
} as const;
export type SeriesKey = keyof typeof SERIES;

/** CSS backgrounds for the small comparison bars: solid / diagonal stripes / dots. */
export const BAR_PATTERN: Record<"child" | "parent" | "teacher", string> = {
  child: "#0072B2",
  parent: "repeating-linear-gradient(135deg, #D55E00 0 4px, #f3b48f 4px 8px)",
  teacher: "radial-gradient(circle, #ffffff 1.3px, transparent 1.6px) 0 0 / 6px 6px, #009E73",
};
