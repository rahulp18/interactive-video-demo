import { formatTimestamp } from "@demo/shared";

/** Duration for lists and cards: "2:05", or "1:02:05" for long videos. */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return formatTimestamp(seconds);
  const h = Math.floor(seconds / 3600);
  const rest = formatTimestamp(seconds % 3600).padStart(5, "0");
  return `${h}:${rest}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function pluralize(count: number, word: string, plural = `${word}s`): string {
  return `${count} ${count === 1 ? word : plural}`;
}
