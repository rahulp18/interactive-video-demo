import { handle } from "@/lib/api/route";
import { json, readJson } from "@/lib/auth/http";
import { setAvatar } from "@/lib/learning/profile";

/** A student picks one of the preset avatars. Teachers get 403, other origins are refused. */
export async function PUT(request: Request) {
  return handle(request, async (user) => json(await setAvatar(user.id, await readJson(request))), { mutating: true, role: "STUDENT" });
}
