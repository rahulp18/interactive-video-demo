import "server-only";
import { AuthError } from "@/lib/auth/errors";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Best-effort fixed-window limiter for unauthenticated endpoints. State is per server instance (in memory), so on a
 * multi-instance deployment put a shared limiter (CDN/WAF or Redis) in front; this only blunts trivial abuse.
 */
export function rateLimit(request: Request, key: string, limit = 120, windowMs = 60_000): void {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (++bucket.count > limit) throw new AuthError("RATE_LIMITED", "Too many requests. Try again shortly.");
}
