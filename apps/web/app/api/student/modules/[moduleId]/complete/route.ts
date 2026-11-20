import { handle, parseId } from "@/lib/api/route";
import { json } from "@/lib/auth/http";
import { completeModule } from "@/lib/learning/service";

/** Completes the module (once; repeats are safe) and returns the rewards. Refused while a required question is open. */
export async function POST(request: Request, ctx: RouteContext<"/api/student/modules/[moduleId]/complete">) {
  return handle(request, async (user) => json(await completeModule(user.id, parseId((await ctx.params).moduleId, "Story"))), {
    mutating: true,
    role: "STUDENT",
  });
}
