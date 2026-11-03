import { handle, parseId } from "@/lib/api/route";
import { json } from "@/lib/auth/http";
import { getResponseSummary, responsesToCsv } from "@/lib/responses/service";

/** Owner only. `?format=csv` downloads one row per respondent per answered question. */
export async function GET(request: Request, ctx: RouteContext<"/api/videos/[id]/responses">) {
  return handle(request, async (user) => {
    const summary = await getResponseSummary(user.id, parseId((await ctx.params).id, "Video"));
    if (new URL(request.url).searchParams.get("format") !== "csv") return json(summary);
    return new Response(responsesToCsv(summary), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="responses-${summary.video.id}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
