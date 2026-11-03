import { handle, parseId } from "@/lib/api/route";
import { json, readJson } from "@/lib/auth/http";
import { deleteInteraction, updateInteraction } from "@/lib/interactions/service";

async function ids(ctx: RouteContext<"/api/videos/[id]/interactions/[interactionId]">) {
  const params = await ctx.params;
  return { videoId: parseId(params.id, "Video"), interactionId: parseId(params.interactionId, "Interaction") };
}

export async function PUT(request: Request, ctx: RouteContext<"/api/videos/[id]/interactions/[interactionId]">) {
  return handle(
    request,
    async (user) => {
      const { videoId, interactionId } = await ids(ctx);
      return json({ interaction: await updateInteraction(user.id, videoId, interactionId, await readJson(request)) });
    },
    { mutating: true },
  );
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/videos/[id]/interactions/[interactionId]">) {
  return handle(
    request,
    async (user) => {
      const { videoId, interactionId } = await ids(ctx);
      await deleteInteraction(user.id, videoId, interactionId);
      return json({ ok: true });
    },
    { mutating: true },
  );
}
