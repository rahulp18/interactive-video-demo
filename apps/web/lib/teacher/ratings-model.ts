// Teacher ratings (FR-4.12): a teacher's optional 1-5 view of each virtue for one student. Pure and browser-safe, so the
// form and the server action validate with the same rules. Marks (STRENGTH / IMPROVE) are a parent concept and are not
// collected here; every teacher row is saved with mark NONE.

export const TEACHER_RATING_MIN = 1;
export const TEACHER_RATING_MAX = 5;
export const TEACHER_NOTES_MAX = 500;

/** What the browser sends: virtueId -> rating, where null (or a missing key) means "skip this virtue". */
export type TeacherRatingsInput = { ratings: Record<string, number | null>; notes?: string | null };

export type TeacherRatingsValue = { ratings: { virtueId: number; rating: number }[]; notes: string | null };

export type RatingsValidation = { value: TeacherRatingsValue; errors?: undefined } | { value?: undefined; errors: Record<string, string> };

/**
 * Checks a ratings payload against the known virtue ids. Only the virtues sent with a rating become rows; an unknown
 * virtue id, a non-integer or out-of-range rating, or over-long notes is an error, and at least one rating is required.
 */
export function validateTeacherRatings(body: unknown, virtueIds: readonly number[]): RatingsValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { errors: { _: "Send the ratings as an object." } };
  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const known = new Set(virtueIds);

  const ratings: { virtueId: number; rating: number }[] = [];
  const map = raw.ratings;
  if (typeof map !== "object" || map === null || Array.isArray(map)) {
    errors.ratings = "Ratings are missing.";
  } else {
    for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
      const virtueId = /^\d{1,10}$/.test(key) ? Number(key) : NaN;
      if (!known.has(virtueId)) {
        errors[`ratings.${key}`] = "Unknown virtue.";
        continue;
      }
      if (value === null || value === undefined) continue; // skipped
      if (typeof value !== "number" || !Number.isInteger(value) || value < TEACHER_RATING_MIN || value > TEACHER_RATING_MAX) {
        errors[`ratings.${key}`] = `Pick a rating from ${TEACHER_RATING_MIN} to ${TEACHER_RATING_MAX}.`;
        continue;
      }
      ratings.push({ virtueId, rating: value });
    }
    if (ratings.length === 0 && Object.keys(errors).length === 0) errors.ratings = "Rate at least one virtue.";
  }

  let notes: string | null = null;
  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== "string") errors.notes = "Notes must be text.";
    else {
      const trimmed = raw.notes.trim();
      if (trimmed.length > TEACHER_NOTES_MAX) errors.notes = `Notes must be at most ${TEACHER_NOTES_MAX} characters.`;
      else notes = trimmed || null;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  ratings.sort((a, b) => a.virtueId - b.virtueId);
  return { value: { ratings, notes } };
}
