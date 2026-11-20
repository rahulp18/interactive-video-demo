import { handle, parseId } from "@/lib/api/route";
import { json, readJson } from "@/lib/auth/http";
import { saveProgress } from "@/lib/learning/service";

/** Remembers where the student stopped. Never completes the module. */
export async function PUT(request: Request, ctx: RouteContext<"/api/student/modules/[moduleId]/progress">) {
  return handle(
    request,
    async (user) => {
      await saveProgress(user.id, parseId((await ctx.params).moduleId, "Story"), await readJson(request));
      return json({ ok: true });
    },
    { mutating: true, role: "STUDENT" },
  );
}
