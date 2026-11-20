"use client";

import { useRef } from "react";
import type { PresentationStyle } from "@/lib/learning/types";
import { cn } from "@/lib/utils";

type Option = { id: number; text: string };

type CommonProps = {
  /** Radio group name (unique per question). */
  name: string;
  options: Option[];
  value: number | null;
  onChange: (optionId: number) => void;
  disabled?: boolean;
};

/** Small chip above the question: tells the child what kind of question this is. */
export const STYLE_CHIP: Record<PresentationStyle, { label: string; emoji: string }> = {
  MORAL_CHOICE: { label: "Think about the story", emoji: "📖" },
  SITUATIONAL: { label: "This one is about YOU", emoji: "🙋" },
  EMOTION: { label: "How does it feel?", emoji: "💭" },
  PREDICT: { label: "Make a guess", emoji: "🔮" },
  RATING: { label: "Slide to show", emoji: "🎚️" },
};

const card =
  "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-base font-medium transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/50";

/**
 * MORAL_CHOICE, SITUATIONAL and PREDICT: big option cards, one radio each (arrow keys work natively). SITUATIONAL
 * gets a "you" accent so the child knows the question is about their own life.
 */
export function ChoiceCards({ style, ...p }: CommonProps & { style: Exclude<PresentationStyle, "EMOTION" | "RATING"> }) {
  const you = style === "SITUATIONAL";
  return (
    <ul className="space-y-3">
      {p.options.map((o) => {
        const chosen = p.value === o.id;
        return (
          <li key={o.id}>
            <label
              className={cn(
                card,
                !p.disabled && "hover:bg-muted/60",
                you ? "border-primary/30" : "border-border",
                chosen && (you ? "border-primary bg-primary/15" : "border-primary bg-primary/10"),
                p.disabled && "cursor-default",
              )}
            >
              <input
                type="radio"
                name={p.name}
                value={o.id}
                checked={chosen}
                disabled={p.disabled}
                onChange={() => p.onChange(o.id)}
                className="size-5 shrink-0 accent-primary"
              />
              {you && (
                <span aria-hidden className="text-2xl leading-none">
                  🙋
                </span>
              )}
              <span className="min-w-0 flex-1 break-words">{o.text}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** "😌 Tempted, but sure it is not mine." -> the face and its words. */
function splitEmoji(text: string): { face: string; words: string } {
  const [face, ...rest] = text.trim().split(/\s+/);
  return { face, words: rest.join(" ") };
}

/** EMOTION: a grid of large emoji tiles, each with its words underneath. */
export function EmotionGrid(p: CommonProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      {p.options.map((o) => {
        const { face, words } = splitEmoji(o.text);
        const chosen = p.value === o.id;
        return (
          <li key={o.id}>
            <label
              className={cn(
                "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-card px-3 py-3 text-center transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/50",
                !p.disabled && "hover:bg-muted/60",
                chosen ? "border-primary bg-primary/10" : "border-border",
                p.disabled && "cursor-default",
              )}
            >
              <input
                type="radio"
                name={p.name}
                value={o.id}
                checked={chosen}
                disabled={p.disabled}
                onChange={() => p.onChange(o.id)}
                className="sr-only"
              />
              <span aria-hidden className="text-5xl leading-none">
                {face}
              </span>
              <span className="text-sm font-medium break-words">{words || face}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

const FACES = ["😞", "🙁", "😐", "🙂", "😄"];

/**
 * RATING: a 5-stop slider with a face for each stop. Nothing is chosen until the child touches or moves it, so no
 * answer can happen by default. `role="slider"` with arrow keys, Home and End.
 */
export function RatingSlider({ options, value, onChange, disabled }: Omit<CommonProps, "name">) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stops = options.length;
  const index = value === null ? -1 : options.findIndex((o) => o.id === value);
  const last = stops - 1;

  const pick = (i: number) => {
    const clamped = Math.min(Math.max(i, 0), last);
    onChange(options[clamped].id);
  };

  const fromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    pick(Math.round(((clientX - rect.left) / rect.width) * last));
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const arrows = ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"];
    if (index === -1 && arrows.includes(e.key)) {
      // From "not chosen yet", the first arrow press lands on the middle; later presses move from there.
      e.preventDefault();
      return pick(Math.floor(last / 2));
    }
    const step: Record<string, number | undefined> = { ArrowRight: index + 1, ArrowUp: index + 1, ArrowLeft: index - 1, ArrowDown: index - 1, Home: 0, End: last };
    const next = step[e.key];
    if (next === undefined) return;
    e.preventDefault();
    pick(next);
  }

  return (
    <div className="space-y-3">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="How much is this like you?"
        aria-valuemin={1}
        aria-valuemax={stops}
        aria-valuenow={index === -1 ? undefined : index + 1}
        aria-valuetext={index === -1 ? "Not chosen yet" : options[index].text}
        aria-disabled={disabled}
        onKeyDown={onKeyDown}
        className="rounded-2xl p-2 outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
      >
        <div
          ref={trackRef}
          className="relative mx-6 h-12 touch-none select-none"
          onPointerDown={(e) => {
            if (disabled) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (!disabled && e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-muted" />
          <div
            className="absolute top-1/2 left-0 h-3 -translate-y-1/2 rounded-full bg-primary/60"
            style={{ width: index === -1 ? 0 : `${(index / last) * 100}%` }}
          />
          {options.map((o, i) => (
            <span
              key={o.id}
              aria-hidden
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border"
              style={{ left: `${(i / last) * 100}%` }}
            />
          ))}
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 bg-card text-2xl shadow-md transition-[left] motion-reduce:transition-none",
              index === -1 ? "border-dashed border-primary/50 opacity-70" : "border-primary",
            )}
            style={{ left: `${((index === -1 ? last / 2 : index) / last) * 100}%` }}
          >
            {index === -1 ? "👆" : FACES[Math.round((index / Math.max(last, 1)) * (FACES.length - 1))]}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-2 px-1 text-sm text-muted-foreground">
          <span>{options[0]?.text}</span>
          <span className="text-right">{options[last]?.text}</span>
        </div>
      </div>
      <p aria-live="polite" className="min-h-6 text-center text-base font-semibold">
        {index === -1 ? "Touch the slider to choose" : options[index].text}
      </p>
    </div>
  );
}
