"use client";

import { CheckCircle2Icon, LoaderCircleIcon, XCircleIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TYPE_LABEL } from "@/components/editor/TypeBadge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ANSWER_TEXT_MAX } from "@/lib/interactions/model";
import { skipInteraction, submitAnswer, submitText } from "@/lib/watch/client";
import type { AnswerResult, PublicInteraction } from "@/lib/watch/service";
import { cn } from "@/lib/utils";

type Props = {
  shareId: string;
  interaction: PublicInteraction;
  /** Called after the viewer answered (and saw feedback) or skipped. */
  onDone: () => void;
};

const FOCUSABLE = 'input, textarea, button, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Modal question shown when playback reaches an interaction. A bottom sheet on small screens, centred over the player
 * from md up. Required interactions have no skip control. Focus moves in on open and is trapped until it closes.
 */
export function InteractionOverlay({ shareId, interaction, onDone }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"choose" | "submitting" | "result">("choose");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isQuiz = interaction.type === "QUIZ";
  const isText = interaction.answerType === "TEXT";
  const hasAnswer = isText ? text.trim().length > 0 : selected !== null;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, textarea")?.focus();
    return () => previous?.focus?.();
  }, []);

  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    // `:disabled` also covers controls inside a disabled fieldset, which a plain [disabled] check misses.
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => !el.matches(":disabled"));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function skip() {
    setPhase("submitting");
    // Recording the skip is best effort: a network hiccup must never trap the viewer on an optional question.
    await skipInteraction(shareId, interaction.id).catch(() => {});
    onDone();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasAnswer || phase !== "choose") return;
    setPhase("submitting");
    setError(null);
    try {
      setResult(isText ? await submitText(shareId, interaction.id, text) : await submitAnswer(shareId, interaction.id, selected!));
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your answer.");
      setPhase("choose");
    }
  }

  const correctId = result?.type === "QUIZ" ? result.correctOptionId : null;
  const expected = result?.type === "QUIZ" ? result.correctAnswer : null;
  const locked = phase !== "choose";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:absolute md:items-center md:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapTab}
        data-testid="interaction-overlay"
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-background p-5 text-foreground shadow-2xl md:max-h-full md:max-w-lg md:rounded-2xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-3" disabled={locked}>
            <legend className="w-full">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {TYPE_LABEL[interaction.type]}
                {interaction.isSkippable ? " · optional" : ""}
              </span>
              <span id={titleId} className="mt-1 block text-lg leading-snug font-semibold">
                {interaction.question}
              </span>
            </legend>
            {isText ? (
              <div className="space-y-2">
                {isQuiz ? (
                  <Input
                    value={text}
                    maxLength={ANSWER_TEXT_MAX}
                    autoComplete="off"
                    aria-label="Your answer"
                    placeholder="Type your answer"
                    onChange={(e) => setText(e.target.value)}
                    className="h-11 text-base"
                  />
                ) : (
                  <Textarea
                    value={text}
                    maxLength={ANSWER_TEXT_MAX}
                    rows={4}
                    aria-label="Your answer"
                    placeholder="Type your answer"
                    onChange={(e) => setText(e.target.value)}
                  />
                )}
                {!locked && <p className="text-right text-xs text-muted-foreground tabular-nums">{text.length}/{ANSWER_TEXT_MAX}</p>}
              </div>
            ) : (
            <ul className="space-y-2">
              {interaction.options.map((o) => {
                const isChosen = selected === o.id;
                const isCorrect = result?.type === "QUIZ" && o.id === correctId;
                const isWrong = result?.type === "QUIZ" && isChosen && !isCorrect;
                return (
                  <li key={o.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                        !locked && "hover:bg-muted/60",
                        isChosen && !result && "border-primary bg-primary/5",
                        isCorrect && "border-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
                        isWrong && "border-red-600 bg-red-50 dark:bg-red-500/10",
                        locked && "cursor-default",
                      )}
                    >
                      <input
                        type="radio"
                        name={`answer-${interaction.id}`}
                        value={o.id}
                        checked={isChosen}
                        onChange={() => setSelected(o.id)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1 break-words">{o.text}</span>
                      {isCorrect && (
                        <>
                          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" aria-hidden />
                          <span className="sr-only">Correct answer</span>
                        </>
                      )}
                      {isWrong && (
                        <>
                          <XCircleIcon className="size-4 shrink-0 text-red-600" aria-hidden />
                          <span className="sr-only">Your answer, incorrect</span>
                        </>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            )}
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {phase === "result" && result && (
            <p role="status" className={cn("text-sm font-medium", result.type === "QUIZ" && (result.correct ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"))}>
              {result.type !== "QUIZ" ? "Thanks for your response." : result.correct ? "Correct!" : expected ? `Not quite. The expected answer is “${expected}”.` : "Not quite. The correct answer is highlighted."}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {phase === "result" ? (
              <Button type="button" size="lg" onClick={onDone} autoFocus>
                Continue
              </Button>
            ) : (
              <>
                {interaction.isSkippable && (
                  <Button type="button" variant="ghost" size="lg" disabled={phase === "submitting"} onClick={() => void skip()}>
                    Skip
                  </Button>
                )}
                <Button type="submit" size="lg" disabled={!hasAnswer || phase === "submitting"}>
                  {phase === "submitting" && <LoaderCircleIcon className="animate-spin" aria-hidden />}
                  {isQuiz ? "Check answer" : "Submit"}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
