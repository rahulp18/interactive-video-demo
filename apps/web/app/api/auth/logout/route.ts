import { assertSameOrigin, clearedSessionCookie, errorResponse, extractCredential, json } from "@/lib/auth/http";
import { logoutSession } from "@/lib/auth/service";

// Idempotent: always clears the cookie and revokes whatever session the request presented.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const credential = extractCredential(request);
    if (credential) await logoutSession(credential.token);
    return json({ ok: true }, 200, { "Set-Cookie": clearedSessionCookie() });
  } catch (error) {
    return errorResponse(error);
  }
}
