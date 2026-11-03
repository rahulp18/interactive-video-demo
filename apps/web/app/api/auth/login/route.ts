import {
  assertSameOrigin,
  errorResponse,
  extractCredential,
  isMobileClient,
  json,
  readJson,
  sessionCookie,
} from "@/lib/auth/http";
import { loginUser } from "@/lib/auth/service";
import { parseLoginInput } from "@/lib/auth/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = parseLoginInput(await readJson(request));
    const { user, session } = await loginUser(input, extractCredential(request)?.token);
    const expiresAt = session.expiresAt.toISOString();

    // Mobile clients get the raw token once, in the body. Web clients get it only as an HttpOnly cookie.
    if (isMobileClient(request)) return json({ user, token: session.token, expiresAt });
    return json({ user, expiresAt }, 200, { "Set-Cookie": sessionCookie(session.token, session.expiresAt) });
  } catch (error) {
    return errorResponse(error);
  }
}
