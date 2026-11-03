// Shared by the server file route and the browser uploader. Nothing here may import server-only code.

export const VIDEO_MAX_FILE_SIZE = "512MB" as const;
export const VIDEO_ALLOWED_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const VIDEO_MAX_DURATION_SECONDS = 24 * 60 * 60;
export const VIDEO_TITLE_MAX = 200;

export type VideoUploadInput = { duration: number; title?: string };

export function isAllowedVideoType(type: string): boolean {
  return (VIDEO_ALLOWED_MIME_TYPES as readonly string[]).includes(type.toLowerCase());
}

/** "My Clip.final.mp4" -> "My Clip.final". Falls back to the full name when nothing remains. */
export function titleFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).trim() || "Untitled video";
  return base.slice(0, VIDEO_TITLE_MAX);
}

/**
 * Standard Schema validator for the metadata the browser reports at upload start. Duration is browser-reported
 * (UploadThing does not probe media), so it is bounds-checked here but remains a hint, not a verified fact.
 */
export const videoUploadInput = {
  "~standard": {
    version: 1 as const,
    vendor: "demo",
    // Type-only slot of the Standard Schema spec; lets UploadThing infer the input type end to end.
    types: undefined as unknown as { input: VideoUploadInput; output: VideoUploadInput },
    validate(value: unknown) {
      const raw = typeof value === "object" && value !== null ? (value as { duration?: unknown; title?: unknown }) : {};
      const { duration } = raw;
      if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0 || duration > VIDEO_MAX_DURATION_SECONDS) {
        return { issues: [{ message: "A valid video duration is required." }] };
      }
      // Optional: a blank title falls back to the file name when the row is created.
      let title: string | undefined;
      if (raw.title !== undefined) {
        if (typeof raw.title !== "string" || raw.title.trim().length > VIDEO_TITLE_MAX) {
          return { issues: [{ message: `Title must be at most ${VIDEO_TITLE_MAX} characters.` }] };
        }
        title = raw.title.trim() || undefined;
      }
      return { value: { duration, ...(title && { title }) } satisfies VideoUploadInput };
    },
  },
};
