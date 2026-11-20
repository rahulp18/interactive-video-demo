import {
  assertSameOrigin,
  errorResponse,
  isMobileClient,
  json,
  readJson,
  sessionCookie,
} from "@/lib/auth/http";
import { AuthError } from "@/lib/auth/errors";
import { registerUser } from "@/lib/auth/service";
import { createSession } from "@/lib/auth/session";
import { parseRegisterInput } from "@/lib/auth/validation";

export async function POST(request: Request) {
  try {
    // Students are created by teachers (see lib/teacher/students.ts#createStudentAccount), not by public sign-up.
    // Kept behind an explicit opt-in so a deployment can still turn self-registration on.
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== "true") {
      throw new AuthError("REGISTRATION_CLOSED", "Accounts are created by your teacher. Ask them for your username and PIN.");
    }
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
