import { handle } from "@/lib/api/route";
import { json } from "@/lib/auth/http";
import { listVideos } from "@/lib/videos/service";

export async function GET(request: Request) {
  return handle(request, async (user) => json({ videos: await listVideos(user.id) }));
}
