"use client";

import { LockIcon, ScaleIcon, SkipForwardIcon, TriangleAlertIcon } from "lucide-react";
import { formatPreciseTimestamp, hasWeights, PRESENTATION_STYLE_INFO, type InteractionDTO } from "@/lib/interactions/model";
import { cn } from "@/lib/utils";
import { TypeBadge } from "./TypeBadge";

/**
 * Interactions in timestamp order. Selecting one seeks the video there and opens it in the configuration panel.
 * For a story module (`moduleVirtueIds`) each row also shows its presentation style and whether it weighs a virtue.
 */
export function InteractionList({
  interactions,
  selectedId,
  onSelect,
  moduleVirtueIds,
}: {
  interactions: InteractionDTO[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  moduleVirtueIds?: readonly number[];
}) {
  if (interactions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground" data-testid="interaction-empty">
        {moduleVirtueIds
          ? "No questions yet. Play or scrub to a moment in the story, then add a survey or quiz."
          : "No interactions yet. Play or scrub to a moment, then add a survey or quiz."}
      </p>
    );
  }
  return (
    <ol className="space-y-2" data-testid="interaction-list">
      {interactions.map((i) => {
        // Only weights for the module's current virtues count as "weighted" here; that is what the editor shows.
        const weighted =
          moduleVirtueIds !== undefined &&
          hasWeights(i.options.map((o) => ({ weights: Object.fromEntries(Object.entries(o.weights).filter(([id]) => moduleVirtueIds.includes(Number(id)))) })));
        return (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onSelect(i.id)}
              aria-current={i.id === selectedId ? "true" : undefined}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                i.id === selectedId && "border-primary/50 bg-primary/5",
              )}
            >
              <span className="mt-0.5 w-16 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{formatPreciseTimestamp(i.timestamp)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{i.question}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <TypeBadge type={i.type} />
                  {moduleVirtueIds && <span className="font-medium text-foreground">{PRESENTATION_STYLE_INFO[i.presentationStyle].label}</span>}
                  <span>{i.answerType === "TEXT" ? "Text answer" : `${i.options.length} options`}</span>
                  <span className="inline-flex items-center gap-1">
                    {i.isSkippable ? <SkipForwardIcon className="size-3" aria-hidden /> : <LockIcon className="size-3" aria-hidden />}
                    {i.isSkippable ? "Skippable" : "Required"}
                  </span>
                  {moduleVirtueIds &&
                    (weighted ? (
                      <span className="inline-flex items-center gap-1 font-medium text-success">
                        <ScaleIcon className="size-3" aria-hidden /> Weighted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-warning">
                        <TriangleAlertIcon className="size-3" aria-hidden /> No weights: scores nothing
                      </span>
                    ))}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
