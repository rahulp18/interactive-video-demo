import { ApiError } from "@/lib/auth/client";
import type { ModuleRewards, SaveAnswerReply, SaveAnswerRequest } from "./types";

async function call<T>(method: "POST" | "PUT", path: string, data?: unknown, keepalive = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: data === undefined ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
      cache: "no-store",
      keepalive,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? "INTERNAL_ERROR", e?.message ?? "Something went wrong.", e?.fields);
  }
  return body as T;
}

const base = (moduleId: number) => `/api/student/modules/${moduleId}`;

export const postAnswer = (moduleId: number, request: SaveAnswerRequest) => call<SaveAnswerReply>("POST", `${base(moduleId)}/answers`, request);

/** Fire-and-forget position save. `keepalive` lets it finish while the page is being left. */
export const putProgress = (moduleId: number, positionSeconds: number) => call<{ ok: true }>("PUT", `${base(moduleId)}/progress`, { positionSeconds }, true);

export const postComplete = (moduleId: number) => call<ModuleRewards>("POST", `${base(moduleId)}/complete`);

/** A failure worth retrying with the same idempotency key: no connection, or a server-side hiccup. */
export const isRetryable = (error: unknown) => error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.status === 429);

/** Saves the child's avatar key. */
export const putAvatar = (avatar: string) => call<{ avatar: string }>("PUT", "/api/student/profile/avatar", { avatar });
