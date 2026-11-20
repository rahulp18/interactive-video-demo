import { rateLimit } from "@/lib/api/rate-limit";
import {
  assertSameOrigin,
  errorResponse,
  extractCredential,
  isMobileClient,
  json,
  readJson,
  sessionCookie,
} from "@/lib/auth/http";
import { loginWithPin } from "@/lib/auth/pin";
import { parsePinLoginInput } from "@/lib/auth/validation";

// Student sign-in (username + 4-digit PIN). The per-account lockout in the database is the real protection;
// the per-IP limiter here is best-effort only.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(request, "pin-login", 30, 60_000);
    const input = parsePinLoginInput(await readJson(request));
    const { user, session } = await loginWithPin(input, extractCredential(request)?.token);
    const expiresAt = session.expiresAt.toISOString();

    if (isMobileClient(request)) return json({ user, token: session.token, expiresAt });
    return json({ user, expiresAt }, 200, { "Set-Cookie": sessionCookie(session.token, session.expiresAt) });
  } catch (error) {
    return errorResponse(error);
  }
}
