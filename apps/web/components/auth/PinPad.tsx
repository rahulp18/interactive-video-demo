"use client";

import { DeleteIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export const PIN_LENGTH = 4;

// Friendly colour cycle from the theme. Digits carry the meaning, so colour is decoration only.
const TONES = ["bg-accent text-accent-foreground", "bg-secondary text-secondary-foreground", "bg-card text-card-foreground"];

/**
 * Big-button PIN entry for children: 4 dots + digits 0-9 + delete. Every button is 56px (>= 48px). Physical digit keys
 * and Backspace work while focus is inside the pad. The digits are shown only as dots and never leave this component's
 * parent state except through `onChange`.
 */
export function PinPad({ value, onChange, disabled }: { value: string; onChange: (next: string) => void; disabled?: boolean }) {
  const add = (digit: string) => value.length < PIN_LENGTH && onChange(value + digit);
  const remove = () => value.length > 0 && onChange(value.slice(0, -1));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      add(event.key);
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      remove();
    }
  }

  const key = "flex h-14 w-full items-center justify-center rounded-2xl border-2 text-2xl font-extrabold shadow-[0_4px_0_var(--border)] outline-none transition-all select-none hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-1 active:shadow-none disabled:opacity-50";

  return (
    <div role="group" aria-labelledby="pin-label" onKeyDown={onKeyDown} className="space-y-4">
      <div className="space-y-2 text-center">
        <p id="pin-label" className="text-sm font-bold">
          🔒 Your secret PIN
        </p>
        <div aria-hidden className="flex justify-center gap-3" data-testid="pin-dots">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={cn("size-5 rounded-full border-2 border-primary transition-all", i < value.length && "scale-110 bg-primary")} />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {value.length} of {PIN_LENGTH} digits entered
        </p>
      </div>
      <div className="mx-auto grid max-w-64 grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit, i) => (
          <button key={digit} type="button" disabled={disabled} onClick={() => add(digit)} className={cn(key, TONES[i % TONES.length])}>
            {digit}
          </button>
        ))}
        <span aria-hidden />
        <button type="button" disabled={disabled} onClick={() => add("0")} className={cn(key, TONES[0])}>
          0
        </button>
        <button type="button" disabled={disabled || value.length === 0} onClick={remove} aria-label="Delete last digit" className={cn(key, "bg-muted text-muted-foreground")}>
          <DeleteIcon className="size-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}
