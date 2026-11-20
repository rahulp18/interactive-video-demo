import "server-only";
import { AuthError } from "@/lib/auth/errors";
import { isAvatarKey } from "@/lib/student/avatars";
import { db } from "@/prisma/db";

/** Saves the child's preset avatar. Only keys from the preset list are accepted (the database also format-checks it). */
export async function setAvatar(userId: number, body: unknown): Promise<{ avatar: string }> {
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  if (!isAvatarKey(raw.avatar)) throw new AuthError("VALIDATION_ERROR", "Pick one of the avatars.", { avatar: "Pick one of the avatars." });
  await db.orm.public.User.where({ id: userId }).updateAll({ avatar: raw.avatar });
  return { avatar: raw.avatar };
}
