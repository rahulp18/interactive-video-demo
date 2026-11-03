"use client";

import { formatPreciseTimestamp, type InteractionType } from "@/lib/interactions/model";
import { cn } from "@/lib/utils";
import { TYPE_DOT, TYPE_LABEL } from "./TypeBadge";

export type TimelineMarker = { id: number; timestamp: number; type: InteractionType; question: string };

type Props = {
  duration: number;
  currentTime: number;
  markers: TimelineMarker[];
  selectedId: number | null;
  /** Unsaved new interaction, drawn as a dashed marker. */
  draft: { timestamp: number; type: InteractionType } | null;
  onSeek: (seconds: number) => void;
  onSelect: (id: number) => void;
};

const pct = (t: number, duration: number) => (duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0);

/**
 * Scrubber with interaction markers positioned by timestamp. The visual track is custom; a transparent native range
 * input on top provides pointer dragging and keyboard control (arrow keys, Home/End) with correct semantics.
 */
export function Timeline({ duration, currentTime, markers, selectedId, draft, onSeek, onSelect }: Props) {
  return (
    <div className="relative h-10 select-none" data-testid="timeline">
      <div className="absolute inset-x-0 top-[22px] h-2 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct(currentTime, duration)}%` }} />
      </div>
      <div
        aria-hidden
        className="absolute top-[22px] h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-primary"
        style={{ left: `${pct(currentTime, duration)}%` }}
      />

      <input
        type="range"
        aria-label="Seek"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(currentTime, duration || 1)}
        disabled={duration <= 0}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="absolute inset-x-0 top-3 h-5 w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none"
      />

      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          data-testid="timeline-marker"
          data-timestamp={m.timestamp}
          aria-label={`${TYPE_LABEL[m.type]} at ${formatPreciseTimestamp(m.timestamp)}: ${m.question}`}
          aria-pressed={m.id === selectedId}
          title={`${formatPreciseTimestamp(m.timestamp)} · ${m.question}`}
          onClick={() => onSelect(m.id)}
          className={cn(
            "absolute top-0 size-4 -translate-x-1/2 rounded-full border-2 border-background shadow outline-none transition-transform hover:scale-125 focus-visible:ring-3 focus-visible:ring-ring/60",
            TYPE_DOT[m.type],
            m.id === selectedId && "scale-125 ring-2 ring-foreground",
          )}
          style={{ left: `${pct(m.timestamp, duration)}%` }}
        />
      ))}

      {draft && (
        <span
          aria-hidden
          data-testid="timeline-draft"
          className={cn("absolute top-0 size-4 -translate-x-1/2 rounded-full border-2 border-dashed border-foreground opacity-80", TYPE_DOT[draft.type])}
          style={{ left: `${pct(draft.timestamp, duration)}%` }}
        />
      )}
    </div>
  );
}
