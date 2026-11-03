"use client";

import { ClockIcon, LoaderCircleIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/auth/client";
import {
  CORRECT_ANSWER_MAX,
  formatPreciseTimestamp,
  OPTION_TEXT_MAX,
  OPTIONS_MAX,
  OPTIONS_MIN,
  parseTimestamp,
  QUESTION_MAX,
  validateInteraction,
  type AnswerType,
  type InteractionDTO,
  type InteractionType,
} from "@/lib/interactions/model";
import { videosApi } from "@/lib/videos/client";
import { cn } from "@/lib/utils";
import { TYPE_LABEL } from "./TypeBadge";

/** What the form starts from: an existing interaction, or a new one (no `id`). */
export type InteractionDraft = {
  id?: number;
  type: InteractionType;
  answerType: AnswerType;
  correctAnswer: string;
  timestamp: number;
  question: string;
  isSkippable: boolean;
  options: { id?: number; text: string; isCorrect: boolean }[];
};

export const emptyDraft = (type: InteractionType, timestamp: number): InteractionDraft => ({
  type,
  answerType: "CHOICE",
  correctAnswer: "",
  timestamp,
  question: "",
  isSkippable: false,
  options: [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
});

export const draftFrom = (i: InteractionDTO): InteractionDraft => ({
  id: i.id,
  type: i.type,
  answerType: i.answerType,
  correctAnswer: i.correctAnswer ?? "",
  timestamp: i.timestamp,
  question: i.question,
  isSkippable: i.isSkippable,
  options: i.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
});

type Row = { key: number; id?: number; text: string; isCorrect: boolean };
let rowKey = 0;
const toRows = (options: InteractionDraft["options"]): Row[] => options.map((o) => ({ ...o, key: ++rowKey }));

type Props = {
  videoId: number;
  duration: number;
  initial: InteractionDraft;
  /** Playback position, for the "use current time" shortcut. */
  currentTime: number;
  /** Fires while the timestamp field holds a valid time; `commit` is true on blur/Enter/shortcut (seek there). */
  onTimeChange: (seconds: number, commit: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (interaction: InteractionDTO) => void;
  onDeleted: (id: number) => void;
  onCancel: () => void;
};

export function InteractionForm({ videoId, duration, initial, currentTime, onTimeChange, onDirtyChange, onSaved, onDeleted, onCancel }: Props) {
  const isNew = initial.id === undefined;
  const [type, setType] = useState(initial.type);
  const [answerType, setAnswerType] = useState(initial.answerType);
  const [correctAnswer, setCorrectAnswer] = useState(initial.correctAnswer);
  const [timeText, setTimeText] = useState(formatPreciseTimestamp(initial.timestamp));
  const [question, setQuestion] = useState(initial.question);
  const [isSkippable, setIsSkippable] = useState(initial.isSkippable);
  const [rows, setRows] = useState<Row[]>(() => toRows(initial.options));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"saving" | "deleting" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const snapshot = (o: { type: string; a: string; c: string; t: string; q: string; s: boolean; rows: { id?: number; text: string; isCorrect: boolean }[] }) =>
    JSON.stringify([o.type, o.a, o.c, o.t, o.q, o.s, o.rows.map((r) => [r.id ?? null, r.text, r.isCorrect])]);
  const [baseline] = useState(() =>
    snapshot({ type: initial.type, a: initial.answerType, c: initial.correctAnswer, t: formatPreciseTimestamp(initial.timestamp), q: initial.question, s: initial.isSkippable, rows: initial.options }),
  );
  const dirty = snapshot({ type, a: answerType, c: correctAnswer, t: timeText, q: question, s: isSkippable, rows }) !== baseline;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const isQuiz = type === "QUIZ";
  const isText = answerType === "TEXT";
  const parsedTime = parseTimestamp(timeText);

  function updateTime(text: string) {
    setTimeText(text);
    const t = parseTimestamp(text);
    if (t !== null && t >= 0 && t <= duration) onTimeChange(t, false);
  }

  function commitTime() {
    const t = parseTimestamp(timeText);
    if (t === null) return;
    const clamped = Math.min(Math.max(t, 0), duration);
    // Out-of-range input is left as typed so validation can explain it; valid input is normalised.
    if (clamped === t) {
      setTimeText(formatPreciseTimestamp(t));
      onTimeChange(t, true);
    }
  }

  function setRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function setCorrect(key: number) {
    setRows((prev) => prev.map((r) => ({ ...r, isCorrect: r.key === key })));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      type,
      answerType,
      correctAnswer,
      timestamp: parsedTime ?? Number.NaN,
      question,
      isSkippable,
      options: isText ? [] : rows.map((r) => ({ ...(r.id !== undefined && { id: r.id }), text: r.text, isCorrect: r.isCorrect })),
    };
    const checked = validateInteraction(payload, duration);
    if (checked.errors) {
      setErrors(parsedTime === null ? { ...checked.errors, timestamp: "Enter a time like 1:05, 1:05.5 or 65." } : checked.errors);
      return;
    }
    setErrors({});
    setBusy("saving");
    try {
      const saved = isNew
        ? await videosApi.createInteraction(videoId, checked.value)
        : await videosApi.updateInteraction(videoId, initial.id!, checked.value);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setFormError(err instanceof Error ? err.message : "Could not save the interaction.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("deleting");
    setFormError(null);
    try {
      await videosApi.deleteInteraction(videoId, initial.id!);
      onDeleted(initial.id!);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not delete the interaction.");
      setBusy(null);
    }
  }

  const err = (key: string) => errors[key];

  return (
    <form onSubmit={save} noValidate className="space-y-5" aria-label={isNew ? "New interaction" : "Edit interaction"} data-testid="interaction-form">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{isNew ? "New interaction" : "Edit interaction"}</h2>
        {dirty && <span className="text-xs text-amber-700 dark:text-amber-400">Unsaved changes</span>}
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Type</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Interaction type">
          {(["SURVEY", "QUIZ"] as const).map((t) => (
            <label
              key={t}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                type === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="interaction-type"
                value={t}
                checked={type === t}
                onChange={() => {
                  setType(t);
                  if (t === "SURVEY") setRows((prev) => prev.map((r) => ({ ...r, isCorrect: false })));
                }}
                className="sr-only"
              />
              {TYPE_LABEL[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Answer format</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Answer format">
          {(["CHOICE", "TEXT"] as const).map((a) => (
            <label
              key={a}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                answerType === a ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input type="radio" name="answer-format" value={a} checked={answerType === a} onChange={() => setAnswerType(a)} className="sr-only" />
              {a === "CHOICE" ? "Multiple choice" : "Text answer"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="ix-time" className="text-sm font-medium">
          Timestamp
        </label>
        <div className="flex gap-2">
          <Input
            id="ix-time"
            value={timeText}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={err("timestamp") ? true : undefined}
            aria-describedby="ix-time-help"
            onChange={(e) => updateTime(e.target.value)}
            onBlur={commitTime}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTime();
              }
            }}
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const t = Math.min(Math.max(currentTime, 0), duration);
              setTimeText(formatPreciseTimestamp(t));
              onTimeChange(Math.round(t * 10) / 10, true);
            }}
          >
            <ClockIcon aria-hidden /> Use current
          </Button>
        </div>
        <p id="ix-time-help" className="text-xs text-muted-foreground">
          Between 0:00 and {formatPreciseTimestamp(duration)}. Enter m:ss, h:mm:ss or seconds.
        </p>
        {err("timestamp") && (
          <p role="alert" className="text-xs text-destructive">
            {err("timestamp")}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="ix-question" className="text-sm font-medium">
          Question
        </label>
        <Textarea
          id="ix-question"
          value={question}
          maxLength={QUESTION_MAX}
          rows={3}
          aria-invalid={err("question") ? true : undefined}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={isQuiz ? "What is the capital of France?" : "How are you finding this so far?"}
        />
        {err("question") && (
          <p role="alert" className="text-xs text-destructive">
            {err("question")}
          </p>
        )}
      </div>

      {isText ? (
        <div className="space-y-1.5">
          {isQuiz ? (
            <>
              <label htmlFor="ix-correct" className="text-sm font-medium">
                Correct answer
              </label>
              <Input
                id="ix-correct"
                value={correctAnswer}
                maxLength={CORRECT_ANSWER_MAX}
                autoComplete="off"
                aria-invalid={err("correctAnswer") ? true : undefined}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="Paris"
              />
              <p className="text-xs text-muted-foreground">Viewers type their answer. Capitalisation and extra spaces are ignored when it is checked.</p>
              {err("correctAnswer") && (
                <p role="alert" className="text-xs text-destructive">
                  {err("correctAnswer")}
                </p>
              )}
            </>
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Viewers answer by typing free text. You will see every answer under Responses.</p>
          )}
        </div>
      ) : (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Answer options <span className="font-normal text-muted-foreground">({OPTIONS_MIN}–{OPTIONS_MAX})</span>
        </legend>
        {isQuiz && <p className="text-xs text-muted-foreground">Select the correct answer.</p>}
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.key} className="space-y-1">
              <div className="flex items-center gap-2">
                {isQuiz && (
                  <input
                    type="radio"
                    name="correct-option"
                    checked={row.isCorrect}
                    onChange={() => setCorrect(row.key)}
                    aria-label={`Mark option ${index + 1} as correct`}
                    className="size-4 shrink-0 accent-emerald-600"
                  />
                )}
                <Input
                  value={row.text}
                  maxLength={OPTION_TEXT_MAX}
                  placeholder={`Option ${index + 1}`}
                  aria-label={`Option ${index + 1} text`}
                  aria-invalid={err(`options.${index}`) ? true : undefined}
                  onChange={(e) => setRow(row.key, { text: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove option ${index + 1}`}
                  disabled={rows.length <= OPTIONS_MIN}
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  <XIcon aria-hidden />
                </Button>
              </div>
              {err(`options.${index}`) && (
                <p role="alert" className="text-xs text-destructive">
                  {err(`options.${index}`)}
                </p>
              )}
            </li>
          ))}
        </ul>
        {err("options") && (
          <p role="alert" className="text-xs text-destructive">
            {err("options")}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length >= OPTIONS_MAX}
          onClick={() => setRows((prev) => [...prev, { key: ++rowKey, text: "", isCorrect: false }])}
        >
          <PlusIcon aria-hidden /> Add option
        </Button>
      </fieldset>
      )}

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={isSkippable} onChange={(e) => setIsSkippable(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
        <span>
          <span className="font-medium">Skippable</span>
          <span className="block text-xs text-muted-foreground">Viewers can continue without answering.</span>
        </span>
      </label>

      {formError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button type="submit" disabled={busy !== null || (!isNew && !dirty)}>
          {busy === "saving" && <LoaderCircleIcon className="animate-spin" aria-hidden />}
          {busy === "saving" ? "Saving…" : isNew ? "Add interaction" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy !== null} onClick={onCancel}>
          {isNew || dirty ? "Cancel" : "Close"}
        </Button>
        {!isNew && !confirmDelete && (
          <Button type="button" variant="ghost" className="ml-auto text-destructive" disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
            <Trash2Icon aria-hidden /> Delete
          </Button>
        )}
        {!isNew && confirmDelete && (
          <div className="ml-auto flex items-center gap-2" role="alertdialog" aria-label="Confirm deleting this interaction">
            <Button type="button" variant="destructive" disabled={busy !== null} onClick={() => void remove()}>
              {busy === "deleting" && <LoaderCircleIcon className="animate-spin" aria-hidden />} Confirm delete
            </Button>
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
