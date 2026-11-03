import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/prisma/db";
import { SESSION_TTL_MS } from "./config";

export type SessionUser = { id: number; name: string; email: string };
export type IssuedSession = { token: string; expiresAt: Date };

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a brand-new session. A token is never reused or accepted from the client, which prevents fixation. */
export async function createSession(userId: number, now = new Date()): Promise<IssuedSession> {
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.orm.public.Session.create({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/** Returns the session's user, or null when the token is unknown, expired or revoked. */
export async function validateSession(token: string, now = new Date()): Promise<SessionUser | null> {
  const tokenHash = hashToken(token);
  const session = await db.orm.public.Session.where({ tokenHash }).first();
  if (!session) return null;

  const a = Buffer.from(session.tokenHash);
  const b = Buffer.from(tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.orm.public.Session.where({ id: session.id }).deleteAll();
    return null;
  }

  const user = await db.orm.public.User.where({ id: session.userId }).first();
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

/** Server-side revocation. Idempotent: revoking an unknown token is a no-op. */
export async function revokeSession(token: string): Promise<void> {
  await db.orm.public.Session.where({ tokenHash: hashToken(token) }).deleteAll();
}
