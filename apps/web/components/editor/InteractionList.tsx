"use client";

import { LockIcon, SkipForwardIcon } from "lucide-react";
import { formatPreciseTimestamp, type InteractionDTO } from "@/lib/interactions/model";
import { cn } from "@/lib/utils";
import { TypeBadge } from "./TypeBadge";

/** Interactions in timestamp order. Selecting one seeks the video there and opens it in the configuration panel. */
export function InteractionList({
  interactions,
  selectedId,
  onSelect,
}: {
  interactions: InteractionDTO[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (interactions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground" data-testid="interaction-empty">
        No interactions yet. Play or scrub to a moment, then add a survey or quiz.
      </p>
    );
  }
  return (
    <ol className="space-y-2" data-testid="interaction-list">
      {interactions.map((i) => (
        <li key={i.id}>
          <button
            type="button"
            onClick={() => onSelect(i.id)}
            aria-current={i.id === selectedId ? "true" : undefined}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
              i.id === selectedId && "border-foreground/40 bg-muted/60",
            )}
          >
            <span className="mt-0.5 w-16 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
              {formatPreciseTimestamp(i.timestamp)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{i.question}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <TypeBadge type={i.type} />
                <span>{i.answerType === "TEXT" ? "Text answer" : `${i.options.length} options`}</span>
                <span className="inline-flex items-center gap-1">
                  {i.isSkippable ? <SkipForwardIcon className="size-3" aria-hidden /> : <LockIcon className="size-3" aria-hidden />}
                  {i.isSkippable ? "Skippable" : "Required"}
                </span>
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
