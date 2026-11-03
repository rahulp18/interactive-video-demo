import { connection } from "next/server";
import { errorResponse, json } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/request";

export async function GET(request: Request) {
  // Opt out of prerendering: this response depends on the caller's credentials.
  await connection();
  try {
    const { user } = await requireUser(request);
    return json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
