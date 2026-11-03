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
