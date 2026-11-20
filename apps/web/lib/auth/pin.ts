import { db } from "@/prisma/db";
import { AuthError } from "./errors";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";
import { createSession, revokeSession, type IssuedSession, type SessionUser } from "./session";
import { isUniqueViolation } from "./service";
import { PIN_PATTERN, USERNAME_PATTERN, normalizeUsername, type PinLoginInput } from "./validation";

/**
 * Student sign-in with username + 4-digit PIN (FR-4.4). A PIN has only 10,000 values, so the guard is a per-account
 * lockout kept IN THE DATABASE: on serverless every request may land on a different instance, so the in-memory
 * per-IP `rateLimit` on the route is only an extra layer, never the protection.
 */
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MS = 15 * 60_000;

const GENERIC = "That username and PIN don't match. Try again.";
const LOCKED = "Too many tries. Ask a grown-up, or try again in a little while.";
const invalid = () => new AuthError("INVALID_CREDENTIALS", GENERIC);
const locked = () => new AuthError("PIN_LOCKED", LOCKED);

const isLocked = (until: Date | null, now: Date) => until !== null && until.getTime() > now.getTime();

/** Records one wrong PIN. Compare-and-set on the counter so concurrent guesses are each counted. Returns true if the account is now locked. */
async function registerFailure(userId: number, now: Date): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await db.orm.public.User.where({ id: userId }).first();
    if (!row) return false;
    if (isLocked(row.pinLockedUntil, now)) return true;
    const count = row.pinFailedAttempts + 1;
    const lock = count >= PIN_MAX_ATTEMPTS;
    const changed = await db.orm.public.User.where({ id: userId, pinFailedAttempts: row.pinFailedAttempts }).updateAndCount(
      lock ? { pinFailedAttempts: 0, pinLockedUntil: new Date(now.getTime() + PIN_LOCK_MS) } : { pinFailedAttempts: count },
    );
    if (changed > 0) return lock;
  }
  return false;
}

export async function loginWithPin(
  input: PinLoginInput,
  previousToken?: string,
  now = new Date(),
): Promise<{ user: SessionUser; session: IssuedSession }> {
  const account = USERNAME_PATTERN.test(input.username) ? await db.orm.public.User.where({ username: input.username }).first() : null;

  // Unknown username, no PIN (teachers can never have one: DB CHECK) or malformed input: same error, similar timing.
  if (!account || !account.pinHash) {
    await verifyAgainstDummy(input.pin);
    throw invalid();
  }
  if (isLocked(account.pinLockedUntil, now)) throw locked(); // even the correct PIN is refused while locked

  const ok = PIN_PATTERN.test(input.pin) && (await verifyPassword(input.pin, account.pinHash));
  if (!ok) throw (await registerFailure(account.id, now)) ? locked() : invalid();

  // Guesses sent in parallel may have locked the account while this one was hashing.
  const fresh = await db.orm.public.User.where({ id: account.id }).first();
  if (!fresh || isLocked(fresh.pinLockedUntil, now)) throw locked();
  if (fresh.pinFailedAttempts !== 0 || fresh.pinLockedUntil !== null) {
    await db.orm.public.User.where({ id: account.id }).updateAll({ pinFailedAttempts: 0, pinLockedUntil: null });
  }

  if (previousToken) await revokeSession(previousToken);
  const session = await createSession(account.id);
  return { user: { id: account.id, name: account.name, email: account.email, role: account.role }, session };
}

/**
 * Server-side only (seed, tests): nobody sets a PIN through the UI in this demo. Students only; clears any lockout.
 * Throws a plain Error for bad input and AuthError CONFLICT if the username is taken.
 */
export async function setStudentCredentials(userId: number, username: string, pin: string): Promise<void> {
  const name = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(name)) throw new Error("Username must be 3-20 characters: a-z, 0-9 or _.");
  if (!PIN_PATTERN.test(pin)) throw new Error("PIN must be exactly 4 digits.");
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) throw new Error("User not found.");
  if (user.role !== "STUDENT") throw new Error("Only students can have a username and PIN.");
  const pinHash = await hashPassword(pin);
  try {
    await db.orm.public.User.where({ id: userId }).updateAll({ username: name, pinHash, pinFailedAttempts: 0, pinLockedUntil: null });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("CONFLICT", "That username is already taken.");
    throw error;
  }
}

/** Clears lockout state for the given users (demo:reset). Leaves username and PIN alone. */
export async function clearPinLockout(userIds: number[]): Promise<void> {
  if (userIds.length === 0) return;
  await db.orm.public.User.where((u) => u.id.in(userIds)).updateAll({ pinFailedAttempts: 0, pinLockedUntil: null });
}
