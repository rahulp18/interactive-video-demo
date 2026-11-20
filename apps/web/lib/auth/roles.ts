import { safeNextPath } from "./redirect";

/**
 * Role rules shared by the server (route guards, API) and the browser (post-login redirect). Pure: no I/O.
 * STUDENT is the only role public registration can produce; TEACHER is granted out of band.
 */
export type UserRole = "STUDENT" | "TEACHER";

export const isUserRole = (value: unknown): value is UserRole => value === "STUDENT" || value === "TEACHER";

/** Where each role starts, and where a role is sent when it asks for something it may not use. */
export function homePathFor(role: UserRole): string {
  return role === "TEACHER" ? "/dashboard" : "/library";
}

// Everything else (/library, /settings, /watch/*, /login, ...) is shared by both roles.
const TEACHER_ONLY = ["/dashboard", "/upload", "/videos", "/surveys", "/quizzes", "/responses"] as const;
const STUDENT_ONLY = ["/home", "/results", "/welcome", "/student"] as const;

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Decoded so "/%64ashboard" cannot slip past a prefix match; undecodable input is treated as not allowed. */
function pathnameOf(path: string): string | null {
  try {
    return decodeURIComponent(path.split(/[?#]/, 1)[0]);
  } catch {
    return null;
  }
}

/** Whether `role` may open the app path `path` (a same-site path, optionally with a query or hash). */
export function canAccessPath(role: UserRole, path: string): boolean {
  const pathname = pathnameOf(path);
  if (pathname === null) return false;
  const blocked = role === "TEACHER" ? STUDENT_ONLY : TEACHER_ONLY;
  return !blocked.some((prefix) => under(pathname, prefix));
}

/**
 * Which kind of account a sign-in page was opened for, judged from its `?next=` (the landing page's Student button
 * sends `/library`, its Teacher button `/dashboard`). Display only, never used for authorization; null = unknown.
 */
export function intendedRoleFor(rawNext: string | null | undefined): UserRole | null {
  const next = safeNextPath(rawNext, "");
  if (!next) return null;
  if (!canAccessPath("TEACHER", next)) return "STUDENT";
  if (!canAccessPath("STUDENT", next)) return "TEACHER";
  return next === "/library" ? "STUDENT" : null;
}

/**
 * Where to send a user who just signed in (or is already signed in and opened /login). A validated `?next=` is honoured
 * only when this role may open it; otherwise the role's own home. Never lets `next` cross a role boundary.
 */
export function postAuthPath(role: UserRole, rawNext: string | null | undefined): string {
  const next = safeNextPath(rawNext, "");
  return next && canAccessPath(role, next) ? next : homePathFor(role);
}

/**
 * Where a user goes right after PUBLIC registration (always a student): the first-time welcome, which then continues
 * to the same destination `postAuthPath` would have picked. Any other role skips the welcome.
 */
export function welcomePathFor(role: UserRole, rawNext: string | null | undefined): string {
  const destination = postAuthPath(role, rawNext);
  if (role !== "STUDENT") return destination;
  return destination === homePathFor(role) ? "/welcome" : `/welcome?next=${encodeURIComponent(destination)}`;
}
