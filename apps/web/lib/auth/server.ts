import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE_NAME } from "./config";
import { validateSession, type SessionUser } from "./session";

/**
 * Resolves the signed-in user for the current request from the HttpOnly session cookie, or null.
 * Reads request data, so callers must render inside a <Suspense> boundary. Deliberately not cached across
 * requests: logout and revocation must take effect immediately.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? validateSession(token) : null;
});

/** For protected pages: returns the user or redirects to /login. */
export async function requireCurrentUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For guest-only pages (login/register): redirects signed-in users to the dashboard. */
export async function redirectIfAuthenticated(): Promise<void> {
  if (await getCurrentUser()) redirect("/dashboard");
}
