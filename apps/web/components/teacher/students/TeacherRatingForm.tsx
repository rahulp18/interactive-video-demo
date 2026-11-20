"use client";

import { CheckCircle2Icon, LoaderCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { saveRatings } from "@/app/(app)/students/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TEACHER_NOTES_MAX, TEACHER_RATING_MAX, TEACHER_RATING_MIN, validateTeacherRatings } from "@/lib/teacher/ratings-model";
import { virtueDisplay } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";

type Virtue = { id: number; slug: string; name: string };

const SCALE = Array.from({ length: TEACHER_RATING_MAX - TEACHER_RATING_MIN + 1 }, (_, i) => TEACHER_RATING_MIN + i);
const SCALE_HINT: Record<number, string> = { 1: "Rarely", 2: "Sometimes", 3: "Often", 4: "Usually", 5: "Consistently" };

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * One teacher rating set: each of the ten virtues (fixed order) gets 1-5 or "Skip". Prefilled from the latest teacher
 * ratings. Saving appends a new set (the history is kept) and the page re-renders with the new composite.
 */
export function TeacherRatingForm({
  studentId,
  studentName,
  virtues,
  initial,
  initialNotes,
}: {
  studentId: number;
  studentName: string;
  virtues: Virtue[];
  initial: Record<number, number>;
  initialNotes: string | null;
}) {
  const [values, setValues] = useState<Record<number, number | null>>(() => Object.fromEntries(virtues.map((v) => [v.id, initial[v.id] ?? null])));
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const rated = Object.values(values).filter((v) => v !== null).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const payload = { ratings: Object.fromEntries(Object.entries(values)), notes };
    const checked = validateTeacherRatings(payload, virtues.map((v) => v.id));
    if (checked.errors) {
      setErrors(checked.errors);
      setMessage({ kind: "error", text: checked.errors.ratings ?? checked.errors.notes ?? "Check the ratings and try again." });
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await saveRatings(studentId, payload);
        if (result.ok) setMessage({ kind: "ok", text: `Saved ${result.saved} rating${result.saved === 1 ? "" : "s"} on ${fmt(result.at)}. The report below now includes them.` });
        else {
          setErrors(result.fields ?? {});
          setMessage({ kind: "error", text: result.error });
        }
      } catch {
        setMessage({ kind: "error", text: "Could not save the ratings. Check your connection and try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label={`Teacher rating for ${studentName}`} data-testid="teacher-rating-form">
      <ul className="divide-y rounded-2xl border bg-card">
        {virtues.map((v) => {
          const d = virtueDisplay(v.slug, v.name);
          const Icon = d.icon;
          const value = values[v.id] ?? null;
          const err = errors[`ratings.${v.id}`];
          return (
            <li key={v.id} className="px-3 py-3 sm:px-4">
              <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <legend className="sr-only">{v.name}</legend>
                <span className="flex min-w-40 flex-1 items-center gap-2.5 font-semibold" aria-hidden>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${d.color}26`, color: d.color }}>
                    <Icon className="size-4" />
                  </span>
                  {v.name}
                </span>
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`${v.name} rating`}>
                  {[...SCALE, null].map((n) => {
                    const checked = value === n;
                    return (
                      <label
                        key={n ?? "skip"}
                        title={n === null ? "Skip this virtue" : `${n}: ${SCALE_HINT[n]}`}
                        className={cn(
                          "flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border px-2.5 text-sm font-semibold tabular-nums transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                          checked
                            ? n === null
                              ? "border-foreground/30 bg-muted text-foreground"
                              : "border-primary bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        <input
                          type="radio"
                          name={`virtue-${v.id}`}
                          className="sr-only"
                          checked={checked}
                          onChange={() => setValues((prev) => ({ ...prev, [v.id]: n }))}
                          aria-label={n === null ? `Skip ${v.name}` : `${v.name}: ${n} (${SCALE_HINT[n]})`}
                        />
                        {n === null ? "Skip" : n}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {err && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {err}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-1.5">
        <label htmlFor="teacher-notes" className="text-sm font-semibold">
          Notes <span className="font-normal text-muted-foreground">(optional, seen by grown-ups only)</span>
        </label>
        <Textarea
          id="teacher-notes"
          value={notes}
          maxLength={TEACHER_NOTES_MAX}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`What have you noticed about ${studentName} in class?`}
          aria-invalid={errors.notes ? true : undefined}
        />
        {errors.notes && (
          <p role="alert" className="text-xs text-destructive">
            {errors.notes}
          </p>
        )}
      </div>

      {message && (
        <p
          role={message.kind === "ok" ? "status" : "alert"}
          className={cn(
            "flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
            message.kind === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
          )}
        >
          {message.kind === "ok" && <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || rated === 0}>
          {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
          {pending ? "Saving…" : "Save teacher rating"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {rated} of {virtues.length} virtues rated
        </span>
      </div>
    </form>
  );
}
