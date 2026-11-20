import { handle, parseId } from "@/lib/api/route";
import { json, readJson } from "@/lib/auth/http";
import { saveAnswer } from "@/lib/learning/service";

/** Saves one answer (and the module progress) for the signed-in student. Retrying with the same idempotency key is safe. */
export async function POST(request: Request, ctx: RouteContext<"/api/student/modules/[moduleId]/answers">) {
  return handle(
    request,
    async (user) => json(await saveAnswer(user.id, parseId((await ctx.params).moduleId, "Story"), await readJson(request))),
    { mutating: true, role: "STUDENT" },
  );
}
