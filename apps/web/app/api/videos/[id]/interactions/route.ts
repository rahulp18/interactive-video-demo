import { handle, parseId } from "@/lib/api/route";
import { json, readJson } from "@/lib/auth/http";
import { createInteraction } from "@/lib/interactions/service";

export async function POST(request: Request, ctx: RouteContext<"/api/videos/[id]/interactions">) {
  return handle(
    request,
    async (user) => {
      const videoId = parseId((await ctx.params).id, "Video");
      return json({ interaction: await createInteraction(user.id, videoId, await readJson(request)) }, 201);
    },
    { mutating: true },
  );
}
