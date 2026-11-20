import { virtueDisplay, virtueTint } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";

/** Icon + name in the virtue's colour. The name and icon always show, so colour is never the only signal. */
export function VirtueChip({ slug, className }: { slug: string; className?: string }) {
  const v = virtueDisplay(slug);
  const Icon = v.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold", className)} style={virtueTint(v.color, 18)}>
      <Icon className="size-4 shrink-0" style={{ color: v.color }} aria-hidden />
      {v.name}
    </span>
  );
}

/** A round icon tile for a virtue (no text). Always put the name next to it. */
export function VirtueIcon({ slug, className }: { slug: string; className?: string }) {
  const v = virtueDisplay(slug);
  const Icon = v.icon;
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-2xl border", className ?? "size-12")} style={virtueTint(v.color, 20)}>
      <Icon className="size-[55%]" style={{ color: v.color }} />
    </span>
  );
}
