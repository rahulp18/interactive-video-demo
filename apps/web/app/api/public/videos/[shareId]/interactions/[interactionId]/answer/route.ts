import { connection } from "next/server";
import { parseId } from "@/lib/api/route";
import { rateLimit } from "@/lib/api/rate-limit";
import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/auth/http";
import { getOptionalUser } from "@/lib/auth/request";
import { checkPublicAnswer } from "@/lib/watch/service";

/** Open to anyone holding the share token. A signed-in caller's answer is also recorded under their account. */
export async function POST(request: Request, ctx: RouteContext<"/api/public/videos/[shareId]/interactions/[interactionId]/answer">) {
  await connection();
  try {
    assertSameOrigin(request);
    rateLimit(request, "public-answer");
    const { shareId, interactionId } = await ctx.params;
    const result = await checkPublicAnswer(shareId, parseId(interactionId, "Interaction"), await readJson(request), (await getOptionalUser(request))?.id ?? null);
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
