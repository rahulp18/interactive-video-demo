"use client";

import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { putAvatar } from "@/lib/learning/client";
import { AVATARS } from "@/lib/student/avatars";
import { cn } from "@/lib/utils";

/** Pick-one grid of preset avatars (radio semantics, 56px targets). Saves on tap, then refreshes so the header updates. */
export function AvatarPicker({ current }: { current: string | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function choose(key: string) {
    if (saving || key === selected) return;
    const previous = selected;
    setSelected(key);
    setSaving(true);
    setError(false);
    try {
      await putAvatar(key);
      router.refresh();
    } catch {
      setSelected(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Choose your avatar" className="grid grid-cols-5 gap-2 sm:gap-3">
        {AVATARS.map((a) => {
          const on = selected === a.key;
          return (
            <button
              key={a.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={a.label}
              disabled={saving}
              onClick={() => choose(a.key)}
              data-testid={`avatar-${a.key}`}
              className={cn(
                "relative flex aspect-square min-h-14 items-center justify-center rounded-2xl border-2 bg-card text-3xl outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:active:scale-95",
                on ? "border-primary bg-accent" : "border-border hover:border-primary/60",
              )}
            >
              <span aria-hidden>{a.emoji}</span>
              {on && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckIcon className="size-3.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p role="status" aria-live="polite" className={cn("min-h-6 text-base", error ? "font-semibold text-destructive" : "text-muted-foreground")}>
        {error ? "Oops, that did not save. Try again!" : saving ? "Saving..." : selected ? "Looking good!" : "Tap an avatar to pick it."}
      </p>
    </div>
  );
}
