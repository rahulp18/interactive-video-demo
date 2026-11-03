import { db } from "@/prisma/db";
import { AuthError } from "./errors";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";
import { createSession, revokeSession, validateSession, type IssuedSession, type SessionUser } from "./session";
import type { LoginInput, RegisterInput } from "./validation";

// Postgres unique_violation (SQLSTATE 23505): the race between two concurrent registrations of one email.
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("sqlState" in error && error.sqlState === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const existing = await db.orm.public.User.where({ email: input.email }).first();
  if (existing) throw new AuthError("EMAIL_TAKEN", "An account with this email already exists.");

  const password = await hashPassword(input.password);
  try {
    const user = await db.orm.public.User.create({ name: input.name, email: input.email, password });
    return { id: user.id, name: user.name, email: user.email };
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("EMAIL_TAKEN", "An account with this email already exists.");
    throw error;
  }
}

/**
 * Always issues a fresh session. `previousToken` (a session the client already held) is revoked so a
 * pre-login token can never become, or stay, an authenticated session.
 */
export async function loginUser(
  input: LoginInput,
  previousToken?: string,
): Promise<{ user: SessionUser; session: IssuedSession }> {
  const account = await db.orm.public.User.where({ email: input.email }).first();
  const valid = account
    ? await verifyPassword(input.password, account.password)
    : await verifyAgainstDummy(input.password);
  if (!account || !valid) throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.");

  if (previousToken) await revokeSession(previousToken);
  const session = await createSession(account.id);
  return { user: { id: account.id, name: account.name, email: account.email }, session };
}

export async function authenticate(token: string): Promise<SessionUser> {
  const user = await validateSession(token);
  if (!user) throw new AuthError("UNAUTHENTICATED", "Authentication required.");
  return user;
}

export const logoutSession = revokeSession;
