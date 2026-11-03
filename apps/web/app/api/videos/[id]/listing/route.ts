import { handle, parseId } from "@/lib/api/route";
import { AuthError } from "@/lib/auth/errors";
import { json, readJson } from "@/lib/auth/http";
import { setListed } from "@/lib/watch/service";

/** PUT { listed: boolean } lists or unlists the video in the platform Library. Owner only. */
export async function PUT(request: Request, ctx: RouteContext<"/api/videos/[id]/listing">) {
  return handle(
    request,
    async (user) => {
      const body = (await readJson(request)) as { listed?: unknown } | null;
      if (typeof body?.listed !== "boolean") throw new AuthError("VALIDATION_ERROR", "Invalid request.", { listed: "Must be true or false." });
      return json(await setListed(user.id, parseId((await ctx.params).id, "Video"), body.listed));
    },
    { mutating: true },
  );
}
