import { CircleDashedIcon, CircleCheckIcon } from "lucide-react";
import { virtueDisplay, virtueTint } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";

/** A virtue as a small tinted chip: icon + name, so colour is never the only signal. */
export function VirtuePill({ slug, name, size = "sm", className }: { slug: string; name?: string; size?: "sm" | "md"; className?: string }) {
  const v = virtueDisplay(slug, name);
  const Icon = v.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap text-foreground",
        size === "sm" ? "h-6 px-2 text-xs" : "h-8 px-3 text-sm",
        className,
      )}
      style={virtueTint(v.color, 14)}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} style={{ color: v.color }} aria-hidden />
      {name ?? v.name}
    </span>
  );
}

/** Square virtue icon tile, for list rows and covers. Decorative unless a label is given. */
export function VirtueTile({ slug, className, label }: { slug: string; className?: string; label?: string }) {
  const v = virtueDisplay(slug);
  const Icon = v.icon;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl border", className)}
      style={virtueTint(v.color, 20)}
    >
      <Icon className="size-1/2" style={{ color: v.color }} strokeWidth={1.9} />
    </span>
  );
}

/** Published / Draft, with an icon and the word (not colour alone). */
export function ModuleStatusBadge({ status, className }: { status: "DRAFT" | "PUBLISHED"; className?: string }) {
  const published = status === "PUBLISHED";
  const Icon = published ? CircleCheckIcon : CircleDashedIcon;
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-bold",
        published ? "bg-success/12 text-success" : "border border-dashed border-warning/60 bg-warning/10 text-warning",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {published ? "Published" : "Draft"}
    </span>
  );
}
