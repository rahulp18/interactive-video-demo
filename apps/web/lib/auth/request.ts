import { AuthError } from "./errors";
import { extractCredential } from "./http";
import { authenticate } from "./service";
import type { SessionUser } from "./session";

/** For protected routes: resolves the caller from the request's credentials only, never from client-supplied IDs. */
export async function requireUser(request: Request): Promise<{ user: SessionUser; token: string }> {
  const credential = extractCredential(request);
  if (!credential) throw new AuthError("UNAUTHENTICATED", "Authentication required.");
  return { user: await authenticate(credential.token), token: credential.token };
}

/** For endpoints open to everyone that behave better for a signed-in caller: the user, or null for anonymous/invalid credentials. */
export async function getOptionalUser(request: Request): Promise<SessionUser | null> {
  try {
    return (await requireUser(request)).user;
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHENTICATED") return null;
    throw error;
  }
}
