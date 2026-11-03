import { ApiError } from "@/lib/auth/client";
import type { AnswerResult } from "./service";

/** The server grades quiz answers so correct options never ship with the page, and records them for signed-in viewers. */
async function send(shareId: string, interactionId: number, payload: { optionId: number } | { text: string } | { skip: true }): Promise<AnswerResult> {
  let res: Response;
  try {
    res = await fetch(`/api/public/videos/${shareId}/interactions/${interactionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? "INTERNAL_ERROR", e?.message ?? "Something went wrong.", e?.fields);
  }
  return body as AnswerResult;
}

export const submitAnswer = (shareId: string, interactionId: number, optionId: number) => send(shareId, interactionId, { optionId });
export const submitText = (shareId: string, interactionId: number, text: string) => send(shareId, interactionId, { text });
export const skipInteraction = (shareId: string, interactionId: number) => send(shareId, interactionId, { skip: true });
