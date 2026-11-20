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
  DEFAULT_PRESENTATION_STYLE,
  formatPreciseTimestamp,
  OPTION_TEXT_MAX,
  OPTIONS_MAX,
  OPTIONS_MIN,
  parseTimestamp,
  PRESENTATION_STYLE_INFO,
  PRESENTATION_STYLES,
  QUESTION_MAX,
  RATING_OPTIONS,
  validateInteraction,
  WEIGHT_STEPS,
  type AnswerType,
  type EditorModule,
  type EditorModuleVirtue,
  type InteractionDTO,
  type InteractionType,
  type OptionWeights,
  type PresentationStyle,
} from "@/lib/interactions/model";
import { videosApi } from "@/lib/videos/client";
import { virtueDisplay } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";
import { TYPE_LABEL } from "./TypeBadge";

/** What the form starts from: an existing interaction, or a new one (no `id`). */
export type InteractionDraft = {
  id?: number;
  type: InteractionType;
  answerType: AnswerType;
  presentationStyle: PresentationStyle;
  correctAnswer: string;
  timestamp: number;
  question: string;
  isSkippable: boolean;
  /** `weights` holds every weight row of the option, including virtues that are no longer on the module. */
  options: { id?: number; text: string; isCorrect: boolean; weights: OptionWeights }[];
};

export const emptyDraft = (type: InteractionType, timestamp: number): InteractionDraft => ({
  type,
  answerType: "CHOICE",
  presentationStyle: type === "QUIZ" ? "PREDICT" : DEFAULT_PRESENTATION_STYLE,
  correctAnswer: "",
  timestamp,
  question: "",
  isSkippable: false,
  options: [
    { text: "", isCorrect: false, weights: {} },
    { text: "", isCorrect: false, weights: {} },
  ],
});

export const draftFrom = (i: InteractionDTO): InteractionDraft => ({
  id: i.id,
  type: i.type,
  answerType: i.answerType,
  presentationStyle: i.presentationStyle,
  correctAnswer: i.correctAnswer ?? "",
  timestamp: i.timestamp,
  question: i.question,
  isSkippable: i.isSkippable,
  options: i.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, weights: { ...o.weights } })),
});

type Row = { key: number; id?: number; text: string; isCorrect: boolean; weights: OptionWeights };
let rowKey = 0;
const toRows = (options: InteractionDraft["options"]): Row[] => options.map((o) => ({ ...o, weights: { ...o.weights }, key: ++rowKey }));

/** Only the module's virtues are edited (and sent); weights for other virtues stay on the server untouched. */
const moduleWeights = (weights: OptionWeights, virtueIds: readonly number[]): OptionWeights =>
  Object.fromEntries(virtueIds.flatMap((id) => (weights[id] ? [[id, weights[id]]] : [])));

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

type Props = {
  videoId: number;
  duration: number;
  /** Set when the video is a PARICHAY story module: enables styles and virtue weights, and hides typed answers. */
  storyModule: EditorModule | null;
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

export function InteractionForm({ videoId, duration, storyModule, initial, currentTime, onTimeChange, onDirtyChange, onSaved, onDeleted, onCancel }: Props) {
  const isNew = initial.id === undefined;
  const isModule = storyModule !== null;
  const virtueIds = storyModule?.virtues.map((v) => v.id) ?? [];
  const [type, setType] = useState(initial.type);
  // The student player cannot show typed answers, so a story module question is always multiple choice.
  const [answerType, setAnswerType] = useState<AnswerType>(isModule ? "CHOICE" : initial.answerType);
  const [style, setStyle] = useState<PresentationStyle>(initial.presentationStyle);
  const [correctAnswer, setCorrectAnswer] = useState(initial.correctAnswer);
  const [timeText, setTimeText] = useState(formatPreciseTimestamp(initial.timestamp));
  const [question, setQuestion] = useState(initial.question);
  const [isSkippable, setIsSkippable] = useState(initial.isSkippable);
  const [rows, setRows] = useState<Row[]>(() => toRows(initial.options));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"saving" | "deleting" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  type Snap = { type: string; a: string; st: string; c: string; t: string; q: string; s: boolean; rows: { id?: number; text: string; isCorrect: boolean; weights: OptionWeights }[] };
  const snapshot = (o: Snap) =>
    JSON.stringify([o.type, o.a, o.st, o.c, o.t, o.q, o.s, o.rows.map((r) => [r.id ?? null, r.text, r.isCorrect, moduleWeights(r.weights, virtueIds)])]);
  const [baseline] = useState(() =>
    snapshot({
      type: initial.type,
      a: initial.answerType,
      st: initial.presentationStyle,
      c: initial.correctAnswer,
      t: formatPreciseTimestamp(initial.timestamp),
      q: initial.question,
      s: initial.isSkippable,
      rows: initial.options,
    }),
  );
  const dirty = snapshot({ type, a: answerType, st: style, c: correctAnswer, t: timeText, q: question, s: isSkippable, rows }) !== baseline;
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

  function setWeight(key: number, virtueId: number, weight: number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const weights = { ...r.weights };
        if (weight === 0) delete weights[virtueId];
        else weights[virtueId] = weight;
        return { ...r, weights };
      }),
    );
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
      ...(isModule && { presentationStyle: style }),
      correctAnswer,
      timestamp: parsedTime ?? Number.NaN,
      question,
      isSkippable,
      options: isText
        ? []
        : rows.map((r) => ({
            ...(r.id !== undefined && { id: r.id }),
            text: r.text,
            isCorrect: r.isCorrect,
            ...(isModule && { weights: moduleWeights(r.weights, virtueIds) }),
          })),
    };
    const checked = validateInteraction(payload, duration, isModule ? { moduleVirtueIds: virtueIds } : {});
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
  const unweighted = isModule && !isText && rows.every((r) => Object.keys(moduleWeights(r.weights, virtueIds)).length === 0);

  return (
    <form onSubmit={save} noValidate className="space-y-5" aria-label={isNew ? "New interaction" : "Edit interaction"} data-testid="interaction-form">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{isNew ? (isModule ? "New story question" : "New interaction") : isModule ? "Edit story question" : "Edit interaction"}</h2>
        {dirty && <span className="text-xs font-semibold text-warning">Unsaved changes</span>}
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Type</legend>
        <Segmented
          name="interaction-type"
          label="Interaction type"
          value={type}
          options={(["SURVEY", "QUIZ"] as const).map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          onChange={(t) => {
            setType(t);
            if (t === "SURVEY") setRows((prev) => prev.map((r) => ({ ...r, isCorrect: false })));
          }}
        />
        {isModule && (
          <p className="text-xs text-muted-foreground">
            <strong className="font-semibold text-foreground">Survey</strong> = no right answer (most virtue questions).{" "}
            <strong className="font-semibold text-foreground">Quiz</strong> = has one right answer (e.g. Predict).
          </p>
        )}
      </fieldset>

      {isModule ? (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">How it&apos;s shown to children</legend>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" role="radiogroup" aria-label="Presentation style">
            {PRESENTATION_STYLES.map((s) => (
              <label
                key={s}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-2 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  style === s ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                )}
              >
                <input type="radio" name="presentation-style" value={s} checked={style === s} onChange={() => setStyle(s)} className="sr-only" />
                <span className="block text-sm font-semibold">{PRESENTATION_STYLE_INFO[s].label}</span>
                <span className="block text-xs text-muted-foreground">{PRESENTATION_STYLE_INFO[s].help}</span>
              </label>
            ))}
          </div>
          {err("presentationStyle") && (
            <p role="alert" className="text-xs text-destructive">
              {err("presentationStyle")}
            </p>
          )}
        </fieldset>
      ) : (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Answer format</legend>
          <Segmented
            name="answer-format"
            label="Answer format"
            value={answerType}
            options={[
              { value: "CHOICE" as const, label: "Multiple choice" },
              { value: "TEXT" as const, label: "Text answer" },
            ]}
            onChange={setAnswerType}
          />
        </fieldset>
      )}
      {err("answerType") && (
        <p role="alert" className="text-xs text-destructive">
          {err("answerType")}
        </p>
      )}

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
          placeholder={
            isModule
              ? isQuiz
                ? "Hare is asleep under a tree. What do you think will happen?"
                : "Hare is far ahead. What should Tortoise do?"
              : isQuiz
                ? "Which step comes first?"
                : "How are you finding this so far?"
          }
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
                placeholder="The tortoise"
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
            Answer options <span className="font-normal text-muted-foreground">({isModule && style === "RATING" ? RATING_OPTIONS : `${OPTIONS_MIN}–${OPTIONS_MAX}`})</span>
          </legend>
          {isQuiz && <p className="text-xs text-muted-foreground">Select the correct answer.</p>}
          {isModule && style === "RATING" && <p className="text-xs text-muted-foreground">{RATING_OPTIONS} options, from lowest to highest.</p>}
          {isModule && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Give each option a weight per virtue: <strong className="text-foreground">+2</strong> shows the virtue strongly,{" "}
              <strong className="text-foreground">−2</strong> goes against it, <strong className="text-foreground">0</strong> is not about it. Weights
              re-score students&apos; existing answers: scores are computed when read.
            </p>
          )}
          <ul className="space-y-2">
            {rows.map((row, index) => {
              const otherWeights = Object.keys(row.weights).filter((id) => !virtueIds.includes(Number(id))).length;
              return (
                <li key={row.key} className={cn("space-y-1", isModule && "rounded-lg border p-2")}>
                  <div className="flex items-center gap-2">
                    {isQuiz && (
                      <input
                        type="radio"
                        name="correct-option"
                        checked={row.isCorrect}
                        onChange={() => setCorrect(row.key)}
                        aria-label={`Mark option ${index + 1} as correct`}
                        className="size-4 shrink-0 accent-success"
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
                  {storyModule && (
                    <div className="space-y-1 pt-1">
                      {storyModule.virtues.map((v) => (
                        <WeightControl
                          key={v.id}
                          name={`w-${row.key}-${v.id}`}
                          virtue={v}
                          optionNumber={index + 1}
                          value={row.weights[v.id] ?? 0}
                          onChange={(w) => setWeight(row.key, v.id, w)}
                        />
                      ))}
                      {otherWeights > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Also keeps {otherWeights === 1 ? "a weight" : `${otherWeights} weights`} for a virtue no longer on this module.
                        </p>
                      )}
                    </div>
                  )}
                  {(err(`options.${index}`) || err(`options.${index}.weights`)) && (
                    <p role="alert" className="text-xs text-destructive">
                      {err(`options.${index}`) ?? err(`options.${index}.weights`)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {err("options") && (
            <p role="alert" className="text-xs text-destructive">
              {err("options")}
            </p>
          )}
          {unweighted && (
            <p className="text-xs font-medium text-warning" role="note">
              No option has a weight yet, so this question will not count towards any virtue.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rows.length >= OPTIONS_MAX}
            onClick={() => setRows((prev) => [...prev, { key: ++rowKey, text: "", isCorrect: false, weights: {} }])}
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
          {busy === "saving" ? "Saving…" : isNew ? (isModule ? "Add question" : "Add interaction") : "Save changes"}
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

function Segmented<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            value === o.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** One virtue's weight for one option: a 5-step radio group. The number is always shown, so colour is never the only cue. */
function WeightControl({
  name,
  virtue,
  optionNumber,
  value,
  onChange,
}: {
  name: string;
  virtue: EditorModuleVirtue;
  optionNumber: number;
  value: number;
  onChange: (weight: number) => void;
}) {
  const d = virtueDisplay(virtue.slug, virtue.name);
  const Icon = d.icon;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
        <Icon className="size-3.5 shrink-0" style={{ color: d.color }} aria-hidden />
        <span className="truncate">{virtue.name}</span>
      </span>
      <div className="flex shrink-0 overflow-hidden rounded-md border" role="radiogroup" aria-label={`${virtue.name} weight for option ${optionNumber}`}>
        {WEIGHT_STEPS.map((w) => {
          const on = value === w;
          return (
            <label
              key={w}
              className={cn(
                "flex h-7 w-8 cursor-pointer items-center justify-center border-l text-xs font-semibold tabular-nums first:border-l-0 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-inset",
                !on && "text-muted-foreground hover:bg-muted",
                on && w > 0 && "bg-success text-background",
                on && w < 0 && "bg-destructive text-background",
                on && w === 0 && "bg-foreground text-background",
              )}
            >
              <input type="radio" name={name} value={w} checked={on} onChange={() => onChange(w)} className="sr-only" aria-label={signed(w)} />
              {signed(w)}
            </label>
          );
        })}
      </div>
    </div>
  );
}
