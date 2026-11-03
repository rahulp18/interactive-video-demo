import { ApiError } from "@/lib/auth/client";
import type { InteractionDTO } from "@/lib/interactions/model";

async function request<T>(method: string, path: string, data?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: data === undefined ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
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
  return body as T;
}

/** Browser-side calls to the video and interaction endpoints. Authorization is enforced by the server. */
export const videosApi = {
  rename: (videoId: number, title: string) => request<{ video: { title: string } }>("PATCH", `/api/videos/${videoId}`, { title }),
  remove: (videoId: number) => request<{ ok: true }>("DELETE", `/api/videos/${videoId}`),
  enableShare: (videoId: number) => request<{ shareId: string }>("PUT", `/api/videos/${videoId}/share`).then((r) => r.shareId),
  disableShare: (videoId: number) => request<{ ok: true }>("DELETE", `/api/videos/${videoId}/share`),
  setListed: (videoId: number, listed: boolean) =>
    request<{ shareId: string | null; isListed: boolean }>("PUT", `/api/videos/${videoId}/listing`, { listed }),
  createInteraction: (videoId: number, input: unknown) =>
    request<{ interaction: InteractionDTO }>("POST", `/api/videos/${videoId}/interactions`, input).then((r) => r.interaction),
  updateInteraction: (videoId: number, id: number, input: unknown) =>
    request<{ interaction: InteractionDTO }>("PUT", `/api/videos/${videoId}/interactions/${id}`, input).then((r) => r.interaction),
  deleteInteraction: (videoId: number, id: number) =>
    request<{ ok: true }>("DELETE", `/api/videos/${videoId}/interactions/${id}`),
};
