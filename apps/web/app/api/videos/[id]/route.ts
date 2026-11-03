import { handle, parseId } from "@/lib/api/route";
import { json, readJson } from "@/lib/auth/http";
import { listVideoInteractions } from "@/lib/interactions/service";
import { deleteVideo, getVideo, updateVideoTitle } from "@/lib/videos/service";

export async function GET(request: Request, ctx: RouteContext<"/api/videos/[id]">) {
  return handle(request, async (user) => {
    const id = parseId((await ctx.params).id, "Video");
    const video = await getVideo(user.id, id);
    return json({ video, interactions: await listVideoInteractions(user.id, id) });
  });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/videos/[id]">) {
  return handle(
    request,
    async (user) => {
      const id = parseId((await ctx.params).id, "Video");
      return json({ video: await updateVideoTitle(user.id, id, await readJson(request)) });
    },
    { mutating: true },
  );
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/videos/[id]">) {
  return handle(
    request,
    async (user) => {
      await deleteVideo(user.id, parseId((await ctx.params).id, "Video"));
      return json({ ok: true });
    },
    { mutating: true },
  );
}
