import { avatarFor } from "@/lib/student/avatars";
import { cn } from "@/lib/utils";

/** The child's avatar (an emoji from the preset list) in a round badge; their first letter until they pick one. Decorative. */
export function AvatarBubble({ avatar, name, className }: { avatar: string | null | undefined; name: string; className?: string }) {
  const preset = avatarFor(avatar);
  return (
    <span
      aria-hidden
      data-testid="avatar"
      data-avatar={preset?.key ?? "none"}
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground", preset ? "text-[1.15em]" : "bg-primary text-primary-foreground", className)}
    >
      {preset ? preset.emoji : name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
