/**
 * Where to send the user after signing in. Only same-site absolute paths are accepted, so `?next=` can never become an
 * open redirect ("//evil.com", "/\evil.com", "https://evil.com" and "javascript:" all fall back to the default).
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || raw.length > 500) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}

/** Appends `?next=` to an auth page link while preserving a valid destination. */
export function withNext(path: string, next: string | null | undefined): string {
  const safe = safeNextPath(next, "");
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
}
