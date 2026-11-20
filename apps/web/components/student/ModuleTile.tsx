import { CheckCircle2Icon, LockIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import { ModuleCover } from "@/components/student/ModuleCover";
import type { ModuleCard } from "@/lib/learning/overview-types";
import { cn } from "@/lib/utils";

/** Watch progress in words ("half-way through"): it describes the video, never the child. */
export function progressWords(fraction: number | null): string {
  if (fraction === null || fraction < 0.15) return "Just started";
  return fraction < 0.65 ? "Half-way through" : "Nearly there";
}

function Status({ module }: { module: ModuleCard }) {
  if (module.status === "completed")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--student-leaf)]">
        <CheckCircle2Icon className="size-4" aria-hidden /> Done!
      </span>
    );
  if (module.status === "locked")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <LockIcon className="size-4" aria-hidden /> Locked
      </span>
    );
  if (module.status === "in-progress")
    return (
      <span className="block space-y-1">
        <span className="text-sm font-semibold text-primary">{progressWords(module.watchedFraction)}</span>
        <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(8, Math.round((module.watchedFraction ?? 0) * 100))}%` }} />
        </span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
      <PlayIcon className="size-4" aria-hidden /> Ready to play
    </span>
  );
}

const tile = "flex flex-col gap-3 rounded-3xl border-2 bg-card p-3 text-left";

/** A story tile. Open stories link to the module page; a locked tile is not a link and only explains why. */
export function ModuleTile({ module }: { module: ModuleCard }) {
  const body = (
    <>
      <ModuleCover virtue={module.virtues[0]} muted={module.status === "locked"} />
      <span className="block px-1 pb-1">
        <span className="block text-lg leading-snug font-bold">{module.title}</span>
        <span className="mt-1 block">
          <Status module={module} />
        </span>
        {module.status === "locked" && <span className="mt-1 block text-sm text-muted-foreground">Finish the stories before it to open it.</span>}
      </span>
    </>
  );
  if (module.status === "locked")
    return (
      <div className={cn(tile, "border-dashed")} data-testid="module-tile" data-status="locked">
        {body}
      </div>
    );
  return (
    <Link
      href={`/student/modules/${module.moduleId}`}
      data-testid="module-tile"
      data-status={module.status}
      className={cn(tile, "outline-none transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50", module.status === "in-progress" && "border-primary/60")}
    >
      {body}
    </Link>
  );
}
