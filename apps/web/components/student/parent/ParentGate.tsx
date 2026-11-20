"use client";

import { DeleteIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { answerChallenge, loadChallenge } from "@/app/(app)/student/parent/actions";
import { cn } from "@/lib/utils";

const MAX_DIGITS = 3; // the biggest answer is 12 x 12 = 144

type View = { kind: "loading" } | { kind: "question"; text: string; note?: string } | { kind: "locked"; until: number };

/**
 * The grown-up check. The server makes the question and keeps the answer; this component only shows the question and
 * sends the digits. It is a gate against children wandering in, not a security boundary.
 */
export function ParentGate() {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [value, setValue] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const padRef = useRef<HTMLDivElement>(null);

  function apply(reply: Awaited<ReturnType<typeof loadChallenge>> | Awaited<ReturnType<typeof answerChallenge>>, wrong = false) {
    if (reply.status === "open") return router.refresh();
    if (reply.status === "locked") return setView({ kind: "locked", until: Date.now() + reply.retryAfterSeconds * 1000 });
    const text = "text" in reply ? reply.text : "";
    setView({ kind: "question", text, note: wrong ? "Not quite. Here is a new one." : undefined });
  }

  useEffect(() => {
    let live = true;
    loadChallenge().then((reply) => live && apply(reply));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick while the cooldown is showing, then fetch a fresh question when it ends.
  const lockedUntil = view.kind === "locked" ? view.until : null;
  useEffect(() => {
    if (lockedUntil === null) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) {
        clearInterval(timer);
        loadChallenge().then((reply) => apply(reply));
      }
    }, 500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedUntil]);

  const busy = pending || view.kind !== "question";
  const add = (d: string) => value.length < MAX_DIGITS && setValue(value + d);
  const remove = () => setValue(value.slice(0, -1));

  function submit() {
    if (busy || value === "") return;
    const answer = Number(value);
    setValue("");
    start(async () => apply(await answerChallenge(answer), true));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey || busy) return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      add(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      remove();
    } else if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      submit();
    }
  }

  const key =
    "flex h-14 w-full items-center justify-center rounded-xl border bg-card text-2xl font-semibold outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-accent disabled:opacity-50";

  return (
    <div className="adult-report mx-auto max-w-sm rounded-2xl border p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
        <ShieldCheckIcon className="size-6" aria-hidden />
      </div>
      <h2 className="text-xl font-semibold">Grown-ups only</h2>
      <p className="mt-1 text-sm text-muted-foreground">This page is for parents and carers. Please answer this to continue.</p>

      {view.kind === "loading" && <p className="mt-8 text-sm text-muted-foreground" role="status">Getting a question…</p>}

      {view.kind === "locked" && (
        <p className="mt-8 rounded-lg bg-muted p-4 text-sm" role="status">
          Too many tries. Please wait {Math.max(1, Math.ceil((view.until - now) / 1000))} seconds, then try again.
        </p>
      )}

      {view.kind === "question" && (
        <div ref={padRef} role="group" aria-labelledby="gate-question" tabIndex={-1} onKeyDown={onKeyDown} className="mt-5 space-y-4 outline-none">
          {view.note && (
            <p className="text-sm text-muted-foreground" role="status">
              {view.note}
            </p>
          )}
          <p id="gate-question" className="text-3xl font-bold tabular-nums">
            {view.text} = ?
          </p>
          <p
            aria-live="polite"
            className="mx-auto flex h-12 w-28 items-center justify-center rounded-lg border bg-background text-2xl font-semibold tabular-nums"
            data-testid="gate-answer"
          >
            {value || <span className="text-muted-foreground">&nbsp;</span>}
          </p>
          <div className="mx-auto grid max-w-64 grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} type="button" disabled={busy} onClick={() => add(d)} className={key}>
                {d}
              </button>
            ))}
            <button type="button" disabled={busy || value === ""} onClick={remove} aria-label="Delete last digit" className={cn(key, "text-muted-foreground")}>
              <DeleteIcon className="size-6" aria-hidden />
            </button>
            <button type="button" disabled={busy} onClick={() => add("0")} className={key}>
              0
            </button>
            <button type="button" disabled={busy || value === ""} onClick={submit} className={cn(key, "bg-primary text-base text-primary-foreground hover:bg-primary/90")}>
              Go
            </button>
          </div>
        </div>
      )}

      <Link href="/student" className="mt-6 inline-flex min-h-12 items-center text-sm text-muted-foreground underline underline-offset-4">
        Back to the app
      </Link>
    </div>
  );
}
