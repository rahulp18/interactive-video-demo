import { virtueDisplay, virtueTint } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";

/**
 * Story cover built from the story's main virtue (colour + big icon) instead of a video frame: every demo story plays
 * the same placeholder clip, so a frame would look identical on every card. Decorative, so the title is shown next to it.
 */
export function ModuleCover({ virtue, className, muted = false }: { virtue: string | undefined; className?: string; muted?: boolean }) {
  const v = virtueDisplay(virtue ?? "");
  const Icon = v.icon;
  return (
    <div
      aria-hidden
      data-testid="module-cover"
      className={cn("relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border-2", muted && "opacity-60 saturate-50", className)}
      style={{ ...virtueTint(v.color, 24), backgroundImage: `radial-gradient(circle at 80% 20%, color-mix(in oklab, ${v.color} 30%, transparent), transparent 60%)` }}
    >
      <Icon className="size-1/3 max-h-24 min-h-10 min-w-10 max-w-24" style={{ color: v.color }} strokeWidth={1.75} />
    </div>
  );
}
