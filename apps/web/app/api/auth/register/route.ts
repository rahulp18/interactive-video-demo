import {
  assertSameOrigin,
  errorResponse,
  isMobileClient,
  json,
  readJson,
  sessionCookie,
} from "@/lib/auth/http";
import { registerUser } from "@/lib/auth/service";
import { createSession } from "@/lib/auth/session";
import { parseRegisterInput } from "@/lib/auth/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await registerUser(parseRegisterInput(await readJson(request)));
    // Registration signs the new user in, mirroring login: mobile gets the raw token once, web an HttpOnly cookie.
    const session = await createSession(user.id);
    const expiresAt = session.expiresAt.toISOString();
    if (isMobileClient(request)) return json({ user, token: session.token, expiresAt }, 201);
    return json({ user, expiresAt }, 201, { "Set-Cookie": sessionCookie(session.token, session.expiresAt) });
  } catch (error) {
    return errorResponse(error);
  }
}
