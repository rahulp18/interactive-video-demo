import { handle, parseId } from "@/lib/api/route";
import { AuthError } from "@/lib/auth/errors";
import { json } from "@/lib/auth/http";
import { isInteractionType } from "@/lib/interactions/model";
import { listInteractionsByVideo } from "@/lib/interactions/service";

/** GET /api/interactions?type=SURVEY|QUIZ&q=text&videoId=1 — the caller's interactions grouped by video. */
export async function GET(request: Request) {
  return handle(request, async (user) => {
    const params = new URL(request.url).searchParams;
    const type = params.get("type");
    if (type !== null && !isInteractionType(type)) {
      throw new AuthError("VALIDATION_ERROR", "Invalid request.", { type: "Type must be SURVEY or QUIZ." });
    }
    const videoId = params.get("videoId");
    const groups = await listInteractionsByVideo(user.id, {
      ...(type !== null && { type }),
      q: params.get("q") ?? undefined,
      ...(videoId !== null && { videoId: parseId(videoId, "Video") }),
    });
    return json({ groups });
  });
}
