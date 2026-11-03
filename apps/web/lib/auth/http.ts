import { CLIENT_TYPE_HEADER, SESSION_COOKIE_NAME } from "./config";
import { AuthError } from "./errors";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    const body = { error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }) } };
    const headers: Record<string, string> = error.code === "UNAUTHENTICATED" ? { "WWW-Authenticate": "Bearer" } : {};
    return json(body, error.status, headers);
  }
  // Log only the error class: messages from the database layer may contain user data.
  // Codes (e.g. DRIVER.CONNECTION_FAILED, ETIMEDOUT) identify the failure without exposing messages.
  const code = (error as { code?: unknown } | null)?.code;
  const causeCode = ((error as { cause?: unknown } | null)?.cause as { code?: unknown } | undefined)?.code;
  console.error(
    "Unhandled auth error:",
    error instanceof Error ? error.name : typeof error,
    typeof code === "string" ? code : "",
    typeof causeCode === "string" ? causeCode : "",
  );
  return json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }, 500);
}

export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new AuthError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  try {
    return await request.json();
  } catch {
    throw new AuthError("INVALID_JSON", "Request body is not valid JSON.");
  }
}

export function isMobileClient(request: Request): boolean {
  return request.headers.get(CLIENT_TYPE_HEADER)?.toLowerCase() === "mobile";
}

/**
 * CSRF defence in depth on top of SameSite=Lax: a browser-supplied Origin on a state-changing request
 * must match this server. Native clients send no Origin and are authenticated by bearer token, not cookies.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin === null) return;
  if (origin !== new URL(request.url).origin) {
    throw new AuthError("FORBIDDEN_ORIGIN", "Cross-origin requests are not allowed.");
  }
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index !== -1 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Bearer token if present (mobile), otherwise the session cookie (web). */
export function extractCredential(request: Request): { token: string; source: "bearer" | "cookie" } | null {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    return match ? { token: match[1], source: "bearer" } : null;
  }
  const cookie = readCookie(request, SESSION_COOKIE_NAME);
  return cookie ? { token: cookie, source: "cookie" } : null;
}

const cookieAttributes = () => [
  "Path=/",
  "HttpOnly",
  "SameSite=Lax",
  ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
];

export function sessionCookie(token: string, expiresAt: Date): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return [`${SESSION_COOKIE_NAME}=${token}`, ...cookieAttributes(), `Expires=${expiresAt.toUTCString()}`, `Max-Age=${maxAge}`].join("; ");
}

export function clearedSessionCookie(): string {
  return [`${SESSION_COOKIE_NAME}=`, ...cookieAttributes(), `Expires=${new Date(0).toUTCString()}`, "Max-Age=0"].join("; ");
}
