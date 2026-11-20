"use client";

import { CircleAlertIcon, CircleCheckIcon, CircleIcon, EyeOffIcon, LoaderCircleIcon, RocketIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { setModuleStatusAction, type ModuleActionResult } from "@/app/(app)/modules/actions";
import { Button } from "@/components/ui/button";
import { canPublish, type ModuleStatus, type ReadinessItem } from "@/lib/teacher/modules-model";
import { cn } from "@/lib/utils";

/**
 * Readiness checklist plus the publish / unpublish button. The server re-checks readiness; this only explains it.
 * Unpublishing a module that sits in a journey asks first, because children who have not finished it cannot unlock
 * the next level of that journey while it is hidden.
 */
export function PublishControl({
  moduleId,
  status,
  readiness,
  journeyNames,
  completedCount,
}: {
  moduleId: number;
  status: ModuleStatus;
  readiness: ReadinessItem[];
  journeyNames: string[];
  completedCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ModuleActionResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const ready = canPublish(readiness);
  const published = status === "PUBLISHED";

  function change(next: ModuleStatus) {
    setConfirming(false);
    startTransition(async () => setResult(await setModuleStatusAction(moduleId, next)));
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2.5" aria-label="Ready to publish checklist">
        {readiness.map((item) => {
          const Icon = item.ok ? CircleCheckIcon : item.required ? CircleAlertIcon : CircleIcon;
          return (
            <li key={item.key} className="flex gap-2.5 text-sm">
              <Icon className={cn("mt-0.5 size-4 shrink-0", item.ok ? "text-success" : item.required ? "text-destructive" : "text-muted-foreground")} aria-hidden />
              <span className="min-w-0">
                <span className="font-semibold">
                  {item.label}
                  <span className="sr-only">{item.ok ? " (done)" : item.required ? " (required, missing)" : " (recommended)"}</span>
                </span>
                {!item.ok && <span className="block text-xs text-muted-foreground">{item.hint}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {published ? (
        confirming ? (
          <div role="alertdialog" aria-label="Confirm unpublishing" className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            <p>
              Children will no longer be able to open this story
              {completedCount > 0 ? `; the ${completedCount} who finished it keep their results` : ""}.
              {journeyNames.length > 0 && (
                <>
                  {" "}
                  It is part of <strong>{journeyNames.join(", ")}</strong>: children who have not finished it can&apos;t unlock the next level until it is
                  published again.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="destructive" onClick={() => change("DRAFT")} disabled={pending}>
                Unpublish
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                Keep published
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" className="h-10 w-full rounded-xl font-bold" onClick={() => setConfirming(true)} disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <EyeOffIcon aria-hidden />} Move back to draft
          </Button>
        )
      ) : (
        <Button type="button" className="h-10 w-full rounded-xl font-bold" onClick={() => change("PUBLISHED")} disabled={pending || !ready}>
          {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <RocketIcon aria-hidden />} Publish to children
        </Button>
      )}
      {!published && !ready && <p className="text-xs text-muted-foreground">Finish the required items above to publish.</p>}

      {result && (
        <p role={result.ok ? "status" : "alert"} className={cn("rounded-lg px-3 py-2 text-sm", result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
          {result.message}
        </p>
      )}
    </div>
  );
}
