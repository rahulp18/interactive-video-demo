import { handle, parseId } from "@/lib/api/route";
import { json } from "@/lib/auth/http";
import { disableSharing, enableSharing } from "@/lib/watch/service";

/** PUT creates (or returns) the public link token; DELETE revokes it. Owner only. */
export async function PUT(request: Request, ctx: RouteContext<"/api/videos/[id]/share">) {
  return handle(
    request,
    async (user) => json({ shareId: await enableSharing(user.id, parseId((await ctx.params).id, "Video")) }),
    { mutating: true },
  );
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/videos/[id]/share">) {
  return handle(
    request,
    async (user) => {
      await disableSharing(user.id, parseId((await ctx.params).id, "Video"));
      return json({ ok: true });
    },
    { mutating: true },
  );
}
