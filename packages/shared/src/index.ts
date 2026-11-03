export type VideoChapter = {
  id: string;
  title: string;
  startSeconds: number;
};

export const demoChapters: VideoChapter[] = [
  { id: "intro", title: "Intro", startSeconds: 0 },
  { id: "choice", title: "Make a choice", startSeconds: 30 },
];

export function formatTimestamp(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}