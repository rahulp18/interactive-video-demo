"use client";

import { CheckIcon, LoaderCircleIcon, PlusIcon, XIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { createModuleAction, saveModuleDetailsAction, type ModuleActionResult } from "@/app/(app)/modules/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTIVITY_MAX,
  AGE_BANDS,
  OBJECTIVE_MAX,
  PROMPT_MAX,
  PROMPTS_MAX,
  SECONDARY_MAX,
  SOURCE_STORY_MAX,
  validateModuleDetails,
  type AgeBand,
} from "@/lib/teacher/modules-model";
import { virtueDisplay, virtueTint } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";

export type DetailsValues = {
  sourceStory: string;
  primaryVirtueId: number | null;
  secondaryVirtueIds: number[];
  ageBand: AgeBand | null;
  learningObjective: string;
  discussionPrompts: string[];
  followUpActivity: string;
};

type Virtue = { id: number; slug: string; name: string };

type Props =
  | { mode: "create"; virtues: Virtue[]; videos: { id: number; title: string }[]; initialVideoId: number | null; initial: DetailsValues }
  | { mode: "edit"; virtues: Virtue[]; moduleId: number; initial: DetailsValues };

const AGE_LABEL: Record<AgeBand, string> = { "8-9": "Ages 8–9", "10-12": "Ages 10–12" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function ModuleDetailsForm(props: Props) {
  const { virtues, initial } = props;
  const uid = useId();
  const [videoId, setVideoId] = useState<number | null>(props.mode === "create" ? props.initialVideoId : null);
  const [values, setValues] = useState<DetailsValues>(initial);
  const [prompts, setPrompts] = useState(() => (initial.discussionPrompts.length > 0 ? initial.discussionPrompts : [""]).map((text, i) => ({ key: i, text })));
  const [nextKey, setNextKey] = useState(prompts.length);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ModuleActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));

  const current: DetailsValues = { ...values, discussionPrompts: prompts.map((p) => p.text) };
  const dirty = JSON.stringify(current) !== baseline;
  const set = <K extends keyof DetailsValues>(key: K, value: DetailsValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setResult(null);
  };

  function toggleSecondary(id: number) {
    const has = values.secondaryVirtueIds.includes(id);
    set("secondaryVirtueIds", has ? values.secondaryVirtueIds.filter((x) => x !== id) : [...values.secondaryVirtueIds, id].slice(0, SECONDARY_MAX));
  }

  function choosePrimary(id: number) {
    setValues((v) => ({ ...v, primaryVirtueId: id, secondaryVirtueIds: v.secondaryVirtueIds.filter((x) => x !== id) }));
    setResult(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const payload = { ...current, discussionPrompts: current.discussionPrompts.filter((p) => p.trim()) };
    const checked = validateModuleDetails(payload, new Set(virtues.map((v) => v.id)));
    const fieldErrors = { ...(checked.errors ?? {}) };
    if (props.mode === "create" && videoId === null) fieldErrors.videoId = "Choose the video for this story.";
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setResult({ ok: false, message: "Please fix the highlighted fields." });
      return;
    }
    startTransition(async () => {
      const res = props.mode === "create" ? await createModuleAction(videoId!, checked.value) : await saveModuleDetailsAction(props.moduleId, checked.value);
      setResult(res);
      if (!res.ok) setErrors(res.fields ?? {});
      else setBaseline(JSON.stringify(current));
    });
  }

  const err = (k: string) => errors[k];
  const describe = (k: string, help?: string) => [help, err(k) && `${uid}-${k}-err`].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={submit} noValidate className="space-y-8" aria-label={props.mode === "create" ? "New story module" : "Module details"}>
      {props.mode === "create" && (
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-video`} className="text-sm font-bold">
            Video
          </label>
          {props.videos.length === 0 ? (
            <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">Every one of your videos is already a story module. Upload a new video first.</p>
          ) : (
            <Select
              id={`${uid}-video`}
              value={videoId ?? ""}
              onChange={(e) => setVideoId(e.target.value ? Number(e.target.value) : null)}
              aria-invalid={err("videoId") ? true : undefined}
              aria-describedby={describe("videoId")}
              className="h-10 rounded-xl"
            >
              <option value="">Choose a video…</option>
              {props.videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </Select>
          )}
          <FieldError id={`${uid}-videoId-err`} message={err("videoId")} />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={`${uid}-story`} className="text-sm font-bold">
          Source story
        </label>
        <Input
          id={`${uid}-story`}
          value={values.sourceStory}
          maxLength={SOURCE_STORY_MAX}
          onChange={(e) => set("sourceStory", e.target.value)}
          placeholder="The Tortoise and the Hare (Aesop's Fables)"
          aria-invalid={err("sourceStory") ? true : undefined}
          aria-describedby={describe("sourceStory", `${uid}-story-help`)}
          className="h-10 rounded-xl"
        />
        <p id={`${uid}-story-help`} className="text-xs text-muted-foreground">
          The tale and its tradition (Panchatantra, Jataka, Aesop, Tenali Raman…). Children see it as &ldquo;Based on…&rdquo;.
        </p>
        <FieldError id={`${uid}-sourceStory-err`} message={err("sourceStory")} />
      </div>

      <fieldset className="space-y-2" aria-describedby={describe("primaryVirtueId")}>
        <legend className="text-sm font-bold">Main virtue</legend>
        <p className="text-xs text-muted-foreground">The virtue this story is about. It sets the story&apos;s cover colour and icon for children.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {virtues.map((v) => {
            const d = virtueDisplay(v.slug, v.name);
            const Icon = d.icon;
            const checked = values.primaryVirtueId === v.id;
            return (
              <label
                key={v.id}
                className={cn(
                  "relative flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  !checked && "border-border bg-card hover:bg-muted",
                )}
                style={checked ? virtueTint(d.color, 18) : undefined}
              >
                <input type="radio" name={`${uid}-primary`} value={v.id} checked={checked} onChange={() => choosePrimary(v.id)} className="sr-only" />
                <Icon className="size-4 shrink-0" style={{ color: d.color }} aria-hidden />
                <span className="min-w-0 truncate">{v.name}</span>
                {checked && <CheckIcon className="ml-auto size-4 shrink-0" aria-label="Selected" />}
              </label>
            );
          })}
        </div>
        <FieldError id={`${uid}-primaryVirtueId-err`} message={err("primaryVirtueId")} />
      </fieldset>

      <fieldset className="space-y-2" aria-describedby={describe("secondaryVirtueIds")}>
        <legend className="text-sm font-bold">
          Supporting virtues <span className="font-normal text-muted-foreground">(up to {SECONDARY_MAX})</span>
        </legend>
        <p className="text-xs text-muted-foreground">
          Answers can also grow these. In the video editor you tag each answer option for the main and supporting virtues.
        </p>
        <div className="flex flex-wrap gap-2">
          {virtues.map((v) => {
            const d = virtueDisplay(v.slug, v.name);
            const Icon = d.icon;
            const isPrimary = v.id === values.primaryVirtueId;
            const checked = values.secondaryVirtueIds.includes(v.id);
            const full = !checked && values.secondaryVirtueIds.length >= SECONDARY_MAX;
            return (
              <label
                key={v.id}
                className={cn(
                  "flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  isPrimary || full ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:bg-muted",
                )}
                style={checked ? virtueTint(d.color, 18) : undefined}
                title={isPrimary ? "Already the main virtue" : full ? `At most ${SECONDARY_MAX}` : undefined}
              >
                <input type="checkbox" checked={checked} disabled={isPrimary || full} onChange={() => toggleSecondary(v.id)} className="sr-only" />
                {checked ? <CheckIcon className="size-3.5" aria-hidden /> : <Icon className="size-3.5" style={{ color: d.color }} aria-hidden />}
                {v.name}
              </label>
            );
          })}
        </div>
        <FieldError id={`${uid}-secondaryVirtueIds-err`} message={err("secondaryVirtueIds")} />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Age band</legend>
        <div className="inline-grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Age band">
          {AGE_BANDS.map((a) => (
            <label
              key={a}
              className={cn(
                "cursor-pointer rounded-lg px-4 py-1.5 text-center text-sm font-semibold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                values.ageBand === a ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input type="radio" name={`${uid}-age`} value={a} checked={values.ageBand === a} onChange={() => set("ageBand", a)} className="sr-only" />
              {AGE_LABEL[a]}
            </label>
          ))}
        </div>
        <FieldError id={`${uid}-ageBand-err`} message={err("ageBand")} />
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor={`${uid}-objective`} className="text-sm font-bold">
          Learning objective
        </label>
        <Textarea
          id={`${uid}-objective`}
          rows={2}
          value={values.learningObjective}
          maxLength={OBJECTIVE_MAX}
          onChange={(e) => set("learningObjective", e.target.value)}
          placeholder="I can keep going step by step, even when something is hard."
          aria-invalid={err("learningObjective") ? true : undefined}
          aria-describedby={describe("learningObjective", `${uid}-objective-help`)}
        />
        <p id={`${uid}-objective-help`} className="text-xs text-muted-foreground">
          Written as an &ldquo;I can…&rdquo; sentence. Children see it as &ldquo;You will learn&rdquo; on the story page.
        </p>
        <FieldError id={`${uid}-learningObjective-err`} message={err("learningObjective")} />
      </div>

      <fieldset className="space-y-2" aria-describedby={describe("discussionPrompts", `${uid}-prompts-help`)}>
        <legend className="text-sm font-bold">
          Discussion prompts <span className="font-normal text-muted-foreground">(for parents and teachers, up to {PROMPTS_MAX})</span>
        </legend>
        <p id={`${uid}-prompts-help`} className="text-xs text-muted-foreground">
          Never shown to the child. They appear in the grown-up report&apos;s next steps.
        </p>
        <ol className="space-y-2">
          {prompts.map((p, i) => (
            <li key={p.key} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
              <Input
                value={p.text}
                maxLength={PROMPT_MAX}
                aria-label={`Discussion prompt ${i + 1}`}
                placeholder={i === 0 ? "When was something hard for you? What helped you keep going?" : "Another question to talk about"}
                onChange={(e) => {
                  setPrompts((all) => all.map((x) => (x.key === p.key ? { ...x, text: e.target.value } : x)));
                  setResult(null);
                }}
                className="h-10 rounded-xl"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove prompt ${i + 1}`}
                disabled={prompts.length <= 1}
                onClick={() => setPrompts((all) => all.filter((x) => x.key !== p.key))}
              >
                <XIcon aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={prompts.length >= PROMPTS_MAX}
          onClick={() => {
            setPrompts((all) => [...all, { key: nextKey, text: "" }]);
            setNextKey((k) => k + 1);
          }}
        >
          <PlusIcon aria-hidden /> Add prompt
        </Button>
        <FieldError id={`${uid}-discussionPrompts-err`} message={err("discussionPrompts")} />
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor={`${uid}-activity`} className="text-sm font-bold">
          Follow-up activity
        </label>
        <Textarea
          id={`${uid}-activity`}
          rows={3}
          value={values.followUpActivity}
          maxLength={ACTIVITY_MAX}
          onChange={(e) => set("followUpActivity", e.target.value)}
          placeholder="Pick one small thing to practise for five minutes a day this week. Colour in a box each day you try."
          aria-invalid={err("followUpActivity") ? true : undefined}
          aria-describedby={describe("followUpActivity", `${uid}-activity-help`)}
        />
        <p id={`${uid}-activity-help`} className="text-xs text-muted-foreground">Shown to the child after they finish the story.</p>
        <FieldError id={`${uid}-followUpActivity-err`} message={err("followUpActivity")} />
      </div>

      {result && (
        <Alert variant={result.ok ? "default" : "destructive"} role={result.ok ? "status" : "alert"} className={result.ok ? "border-success/30 bg-success/10 text-success" : undefined}>
          <AlertDescription className={result.ok ? "text-success" : undefined}>{result.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-5">
        <Button type="submit" size="lg" className="h-10 rounded-xl px-5 font-bold" disabled={pending || (props.mode === "edit" && !dirty)}>
          {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
          {props.mode === "create" ? (pending ? "Creating…" : "Create story module") : pending ? "Saving…" : "Save details"}
        </Button>
        {props.mode === "edit" && dirty && !pending && <span className="text-sm font-semibold text-warning">Unsaved changes</span>}
        {props.mode === "create" && <span className="text-sm text-muted-foreground">It starts as a draft. Children can&apos;t see it until you publish.</span>}
      </div>
    </form>
  );
}
