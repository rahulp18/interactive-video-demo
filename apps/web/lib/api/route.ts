import { connection } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { assertSameOrigin, errorResponse } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/request";
import type { SessionUser } from "@/lib/auth/session";

/** `/api/videos/[id]` params arrive as strings; anything that is not a plain positive int32 cannot exist. */
export function parseId(value: string, what = "Resource"): number {
  const id = /^\d{1,10}$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) throw new AuthError("NOT_FOUND", `${what} not found.`);
  return id;
}

/**
 * Shared shell for authenticated route handlers: opts out of prerendering, resolves the caller from credentials only,
 * applies the same-origin check to state-changing requests and maps errors to the standard error envelope.
 */
export async function handle(
  request: Request,
  fn: (user: SessionUser) => Promise<Response>,
  options: { mutating?: boolean } = {},
): Promise<Response> {
  await connection();
  try {
    if (options.mutating) assertSameOrigin(request);
    const { user } = await requireUser(request);
    return await fn(user);
  } catch (error) {
    return errorResponse(error);
  }
}
