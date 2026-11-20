import { avatarFor } from "@/lib/student/avatars";
import { cn } from "@/lib/utils";

/** The child's chosen preset (an emoji), or their initial. Decorative: the name is always shown next to it. */
export function StudentAvatar({ name, avatar, className }: { name: string; avatar: string | null; className?: string }) {
  const preset = avatarFor(avatar);
  return (
    <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-foreground", className)}>
      {preset?.emoji ?? (name.trim().charAt(0).toUpperCase() || "?")}
    </span>
  );
}

/** "@aarav" for students with a username, otherwise their email. */
export const studentHandle = (s: { username: string | null; email: string | null }) => (s.username ? `@${s.username}` : (s.email ?? ""));
