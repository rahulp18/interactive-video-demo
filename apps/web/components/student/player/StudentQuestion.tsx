"use client";

import { LoaderCircleIcon, RotateCcwIcon, Volume2Icon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/components/player/useFocusTrap";
import { ApiError } from "@/lib/auth/client";
import { isRetryable, postAnswer } from "@/lib/learning/client";
import type { SaveAnswerReply, SaveAnswerRequest } from "@/lib/learning/types";
import type { PublicInteraction } from "@/lib/watch/service";
import { ChoiceCards, EmotionGrid, RatingSlider, STYLE_CHIP } from "./answers";
import { useSpeech } from "./speech";

type Props = {
  moduleId: number;
  interaction: PublicInteraction;
  /** Time this question was already on screen before (earlier visits, before "Watch again"). */
  priorMs: number;
  /** How many times the child pressed "Watch again" on this question so far. */
  replays: number;
  /** Where the video is right now, saved with the answer so the child resumes here. */
  getPosition: () => number;
  /** "Watch again" was pressed after `visibleMs` of total time on this question. */
  onWatchAgain: (visibleMs: number) => void;
  /** The answer is saved on the server and the child pressed Continue. */
  onDone: () => void;
};

/** Automatic retries (same idempotency key) before the child is offered a button. */
const AUTO_RETRIES = 3;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`);

/**
 * One question at a time, drawn for its presentation style. The video only moves on after the server confirms the
 * save. If the network drops, the answer is kept and retried with the SAME idempotency key (so it is never counted
 * twice); after a few tries a friendly button takes over. Nothing here shows a score or says an answer was "wrong".
 */
export function StudentQuestion({ moduleId, interaction, priorMs, replays, getPosition, onWatchAgain, onDone }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const trapTab = useFocusTrap(dialogRef, 'input:checked, input, [role="slider"], button');
  const { canSpeak, speak, stop } = useSpeech();

  const shownAt = useRef(0);
  const payload = useRef<SaveAnswerRequest | null>(null);
  const alive = useRef(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"choose" | "saving" | "retrying" | "failed" | "saved">("choose");
  const [reply, setReply] = useState<SaveAnswerReply | null>(null);
  const [error, setError] = useState<string | null>(null);

  const style = interaction.presentationStyle;
  const chip = STYLE_CHIP[style];
  const locked = phase !== "choose";
  const options = interaction.options;

  useEffect(() => {
    alive.current = true;
    shownAt.current = Date.now(); // the clock starts when the question is on screen
    return () => {
      alive.current = false;
    };
  }, []);

  /** Sends the stored payload; the same payload (and key) goes out on every retry. */
  async function send() {
    const request = payload.current;
    if (!request) return;
    setError(null);
    for (let attempt = 0; attempt <= AUTO_RETRIES; attempt++) {
      setPhase(attempt === 0 ? "saving" : "retrying");
      try {
        const saved = await postAnswer(moduleId, request);
        if (!alive.current) return;
        setReply(saved);
        setPhase("saved");
        return;
      } catch (err) {
        if (!alive.current) return;
        if (!isRetryable(err)) {
          setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
          payload.current = null; // a fresh key for a corrected answer
          setPhase("choose");
          return;
        }
        if (attempt < AUTO_RETRIES) await wait(1200 * (attempt + 1));
      }
    }
    if (alive.current) setPhase("failed");
  }

  // When the connection comes back, a stuck answer is sent again by itself.
  useEffect(() => {
    if (phase !== "failed") return;
    const again = () => void send();
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `send` reads refs only
  }, [phase]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null || phase !== "choose") return;
    stop();
    payload.current = {
      interactionId: interaction.id,
      optionId: selected,
      responseTimeMs: priorMs + (Date.now() - shownAt.current),
      replayCount: replays,
      positionSeconds: getPosition(),
      idempotencyKey: newKey(),
    };
    void send();
  }

  const sentence = () => [interaction.question, ...(style === "RATING" ? [`From ${options[0]?.text} to ${options[options.length - 1]?.text}`] : options.map((o) => o.text))];

  const followUp =
    reply?.type === "QUIZ" ? (reply.matched ? "Good guess! 🌟 Let's see what happens." : "Let's see what happens!") : style === "PREDICT" ? "Let's find out!" : "Thank you for sharing! Let's keep watching.";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:absolute md:items-center md:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapTab}
        data-testid="student-question"
        data-style={style}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl md:max-h-full md:max-w-xl md:rounded-3xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-4" disabled={locked}>
            <legend className="w-full space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
                <span aria-hidden>{chip.emoji}</span> {chip.label}
              </span>
              <span id={titleId} className="block text-xl leading-snug font-bold">
                {interaction.question}
              </span>
            </legend>

            {style === "EMOTION" ? (
              <EmotionGrid name={`q-${interaction.id}`} options={options} value={selected} onChange={setSelected} disabled={locked} />
            ) : style === "RATING" ? (
              <RatingSlider options={options} value={selected} onChange={setSelected} disabled={locked} />
            ) : (
              <ChoiceCards style={style} name={`q-${interaction.id}`} options={options} value={selected} onChange={setSelected} disabled={locked} />
            )}
          </fieldset>

          {error && (
            <p role="alert" className="text-base font-medium text-destructive">
              {error}
            </p>
          )}
          {(phase === "saving" || phase === "retrying") && (
            <p role="status" className="flex items-center gap-2 text-base font-medium text-muted-foreground">
              <LoaderCircleIcon className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> Saving…
            </p>
          )}
          {phase === "failed" && (
            <p role="status" className="text-base font-medium">
              We could not save your answer yet. It is safe, and we will keep trying.
            </p>
          )}
          {phase === "saved" && (
            <p role="status" className="text-lg font-bold" data-testid="student-feedback">
              {followUp}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {phase === "saved" ? (
              <Button type="button" size="lg" className="ml-auto h-12 px-6 text-base" onClick={onDone} autoFocus>
                Continue
              </Button>
            ) : phase === "failed" ? (
              <Button type="button" size="lg" className="ml-auto h-12 px-6 text-base" onClick={() => void send()} autoFocus>
                Try again
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-12 text-base"
                  disabled={locked}
                  onClick={() => {
                    stop();
                    onWatchAgain(priorMs + (Date.now() - shownAt.current));
                  }}
                >
                  <RotateCcwIcon aria-hidden /> Watch again
                </Button>
                {canSpeak && (
                  <Button type="button" variant="outline" size="lg" className="h-12 text-base" disabled={locked} onClick={() => speak(sentence())}>
                    <Volume2Icon aria-hidden /> Read to me
                  </Button>
                )}
                <Button type="submit" size="lg" className="ml-auto h-12 px-6 text-base" disabled={selected === null || locked}>
                  That&apos;s my answer
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
