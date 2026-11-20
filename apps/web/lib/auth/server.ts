import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE_NAME } from "./config";
import { homePathFor, postAuthPath, type UserRole } from "./roles";
import { validateSession, type SessionUser } from "./session";

/**
 * Resolves the signed-in user for the current request from the HttpOnly session cookie, or null.
 * Reads request data, so callers must render inside a <Suspense> boundary. Deliberately not cached across
 * requests: logout and revocation must take effect immediately.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Session expiry compares against the current time, which Next.js refuses to read while prerendering (including the
  // runtime prerender behind partial prefetching). The user is per-request data, so make that explicit.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? validateSession(token) : null;
});

/** For protected pages: returns the user or redirects to /login. */
export async function requireCurrentUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * For pages only one role may use. A signed-out visitor goes to /login; a signed-in user of the other role is sent to
 * their own home instead of seeing the page. Pages must call this themselves: layouts do not re-run on client navigation.
 */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await requireCurrentUser();
  if (user.role !== role) redirect(homePathFor(user.role));
  return user;
}
export const requireTeacher = () => requireRole("TEACHER");
export const requireStudent = () => requireRole("STUDENT");

/**
 * For guest-only pages (login): sends signed-in users on, to the validated `next` when their role may open it,
 * otherwise to their role's home.
 */
export async function redirectIfAuthenticated(rawNext?: string | null): Promise<void> {
  const user = await getCurrentUser();
  if (user) redirect(postAuthPath(user.role, rawNext));
}
