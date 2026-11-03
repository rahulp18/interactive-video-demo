"use client";

import {
  ArrowLeftIcon,
  ClipboardListIcon,
  CircleHelpIcon,
  LoaderCircleIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DeleteVideoButton } from "@/components/videos/DeleteVideoButton";
import { formatPreciseTimestamp, roundTimestamp, sortInteractions, type InteractionDTO, type InteractionType } from "@/lib/interactions/model";
import { VIDEO_TITLE_MAX } from "@/lib/videos/policy";
import { videosApi } from "@/lib/videos/client";
import { draftFrom, emptyDraft, InteractionForm } from "./InteractionForm";
import { InteractionList } from "./InteractionList";
import { SharePanel } from "./SharePanel";
import { Timeline } from "./Timeline";

type Selection =
  | { kind: "none" }
  | { kind: "existing"; id: number }
  | { kind: "new"; type: InteractionType; timestamp: number; nonce: number };

export type EditorVideo = { id: number; title: string; fileUrl: string; duration: number; shareId: string | null; isListed: boolean };

type Props = {
  video: EditorVideo;
  initialInteractions: InteractionDTO[];
  /** Deep-link state from the URL: edit an interaction, start a new one, or focus the title field. */
  initial: { editId?: number; newType?: InteractionType; time?: number; focusTitle?: boolean };
};

const DISCARD = "Discard your unsaved changes?";

let newNonce = 0;

function initialSelection(props: Props): Selection {
  const { video, initialInteractions, initial } = props;
  if (initial.editId !== undefined && initialInteractions.some((i) => i.id === initial.editId)) {
    return { kind: "existing", id: initial.editId };
  }
  if (initial.newType) {
    const t = roundTimestamp(Math.min(Math.max(initial.time ?? 0, 0), video.duration));
    return { kind: "new", type: initial.newType, timestamp: t, nonce: ++newNonce };
  }
  return { kind: "none" };
}

export function VideoEditor(props: Props) {
  const { video, initialInteractions, initial } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);

  const [interactions, setInteractions] = useState(() => sortInteractions(initialInteractions));
  const [selection, setSelection] = useState<Selection>(() => initialSelection(props));
  const [draftTime, setDraftTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped on every save so the form remounts from the saved values (its dirty baseline resets).
  const [version, setVersion] = useState(0);

  const [title, setTitle] = useState(video.title);
  const [savedTitle, setSavedTitle] = useState(video.title);
  const [titleState, setTitleState] = useState<"idle" | "saving">("idle");
  const [titleError, setTitleError] = useState<string | null>(null);

  const duration = video.duration;
  const selectedId = selection.kind === "existing" ? selection.id : null;

  const seek = useCallback(
    (seconds: number) => {
      const t = Math.min(Math.max(seconds, 0), duration);
      const el = videoRef.current;
      if (el) el.currentTime = t;
      setCurrentTime(t);
    },
    [duration],
  );

  // A deep-linked selection opens the player at its moment, once the media can seek.
  const [startTime] = useState<number | null>(() => {
    const sel = initialSelection(props);
    if (sel.kind === "new") return sel.timestamp;
    if (sel.kind === "existing") return initialInteractions.find((i) => i.id === sel.id)?.timestamp ?? null;
    return null;
  });
  useEffect(() => {
    const el = videoRef.current;
    if (startTime === null || !el) return;
    const go = () => seek(startTime);
    if (el.readyState >= 1) go();
    else el.addEventListener("loadedmetadata", go, { once: true });
    return () => el.removeEventListener("loadedmetadata", go);
  }, [startTime, seek]);

  const confirmDiscard = () => !dirtyRef.current || window.confirm(DISCARD);

  function revealPanel() {
    // On narrow screens the panel sits below the player; bring it into view.
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function select(id: number) {
    if (selection.kind === "existing" && selection.id === id) return;
    if (!confirmDiscard()) return;
    dirtyRef.current = false;
    setDraftTime(null);
    setNotice(null);
    videoRef.current?.pause();
    const target = interactions.find((i) => i.id === id);
    if (target) seek(target.timestamp);
    setSelection({ kind: "existing", id });
    revealPanel();
  }

  function addAtCurrent(type: InteractionType) {
    if (!confirmDiscard()) return;
    dirtyRef.current = false;
    videoRef.current?.pause();
    const t = roundTimestamp(Math.min(Math.max(videoRef.current?.currentTime ?? currentTime, 0), duration));
    setNotice(null);
    setDraftTime(t);
    setSelection({ kind: "new", type, timestamp: t, nonce: ++newNonce });
    revealPanel();
  }

  // Bound to the form's Cancel/Close button: the user is explicitly discarding, so no extra confirmation.
  function closePanel() {
    dirtyRef.current = false;
    setDraftTime(null);
    setSelection({ kind: "none" });
  }

  function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setMediaError(true));
    else el.pause();
  }

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const onTimeChange = useCallback(
    (seconds: number, commit: boolean) => {
      setDraftTime(seconds);
      if (commit) seek(seconds);
    },
    [seek],
  );

  // Warn before leaving the page with unsaved interaction edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  async function saveTitle(e: React.FormEvent) {
    e.preventDefault();
    setTitleError(null);
    setTitleState("saving");
    try {
      const { video: updated } = await videosApi.rename(video.id, title);
      setTitle(updated.title);
      setSavedTitle(updated.title);
    } catch (err) {
      setTitleError(err instanceof Error ? err.message : "Could not rename the video.");
    } finally {
      setTitleState("idle");
    }
  }

  const panelKey = selection.kind === "existing" ? `e${selection.id}-${version}` : selection.kind === "new" ? `n${selection.nonce}` : "none";
  const selected = selection.kind === "existing" ? interactions.find((i) => i.id === selection.id) : undefined;
  const draftMarker =
    selection.kind === "new" ? { timestamp: draftTime ?? selection.timestamp, type: selection.type } : null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/videos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden /> My Videos
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <form onSubmit={saveTitle} className="flex min-w-0 flex-1 basis-72 gap-2">
            <Input
              aria-label="Video title"
              value={title}
              maxLength={VIDEO_TITLE_MAX}
              autoFocus={initial.focusTitle}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-base font-semibold"
            />
            <Button type="submit" variant="outline" size="lg" disabled={titleState === "saving" || title.trim() === savedTitle || !title.trim()}>
              {titleState === "saving" && <LoaderCircleIcon className="animate-spin" aria-hidden />} Rename
            </Button>
          </form>
          <DeleteVideoButton videoId={video.id} title={savedTitle} redirectTo="/videos" size="default" />
        </div>
        <SharePanel videoId={video.id} initialShareId={video.shareId} initialListed={video.isListed} />
        {titleError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{titleError}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-5">
          <div className="overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              src={video.fileUrl}
              preload="metadata"
              playsInline
              onClick={togglePlay}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onSeeked={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onLoadedMetadata={() => setMediaError(false)}
              onError={() => setMediaError(true)}
              className="aspect-video w-full cursor-pointer"
              data-testid="editor-video"
            />
          </div>
          {mediaError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>This video could not be played in your browser. You can still edit its interactions.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="icon-lg" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} data-testid="play-toggle">
                {playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
              </Button>
              <Button type="button" variant="ghost" size="icon-lg" aria-label="Back 5 seconds" onClick={() => seek(currentTime - 5)}>
                <RotateCcwIcon aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon-lg" aria-label="Forward 5 seconds" onClick={() => seek(currentTime + 5)}>
                <RotateCwIcon aria-hidden />
              </Button>
              <p className="font-mono text-sm tabular-nums" aria-live="off" data-testid="time-readout">
                <span data-testid="current-time">{formatPreciseTimestamp(currentTime)}</span>
                <span className="text-muted-foreground"> / </span>
                <span data-testid="total-duration">{formatPreciseTimestamp(duration)}</span>
              </p>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => addAtCurrent("SURVEY")}>
                  <ClipboardListIcon aria-hidden /> Add survey here
                </Button>
                <Button type="button" variant="outline" onClick={() => addAtCurrent("QUIZ")}>
                  <CircleHelpIcon aria-hidden /> Add quiz here
                </Button>
              </div>
            </div>
            <Timeline
              duration={duration}
              currentTime={currentTime}
              markers={interactions}
              selectedId={selectedId}
              draft={draftMarker}
              onSeek={seek}
              onSelect={select}
            />
          </div>

          <section aria-labelledby="interactions-heading" className="space-y-3">
            <h2 id="interactions-heading" className="text-base font-semibold">
              Interactions <span className="font-normal text-muted-foreground">({interactions.length})</span>
            </h2>
            <InteractionList interactions={interactions} selectedId={selectedId} onSelect={select} />
          </section>
        </div>

        <div ref={panelRef} className="min-w-0 scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent>
              {notice && (
                <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {notice}
                </p>
              )}
              {selection.kind === "none" ? (
                <div className="py-6 text-center text-sm text-muted-foreground" data-testid="panel-empty">
                  <p className="font-medium text-foreground">Configure an interaction</p>
                  <p className="mt-1">
                    Select a marker or list item to edit it, or use “Add survey here” / “Add quiz here” at the current position.
                  </p>
                </div>
              ) : (
                <InteractionForm
                  key={panelKey}
                  videoId={video.id}
                  duration={duration}
                  initial={selection.kind === "new" ? emptyDraft(selection.type, selection.timestamp) : draftFrom(selected!)}
                  currentTime={currentTime}
                  onTimeChange={onTimeChange}
                  onDirtyChange={onDirtyChange}
                  onCancel={closePanel}
                  onSaved={(saved) => {
                    dirtyRef.current = false;
                    setDraftTime(null);
                    setInteractions((prev) => sortInteractions([...prev.filter((i) => i.id !== saved.id), saved]));
                    setSelection({ kind: "existing", id: saved.id });
                    setVersion((v) => v + 1);
                    setNotice("Interaction saved.");
                  }}
                  onDeleted={(id) => {
                    dirtyRef.current = false;
                    setDraftTime(null);
                    setInteractions((prev) => prev.filter((i) => i.id !== id));
                    setSelection({ kind: "none" });
                    setNotice("Interaction deleted.");
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
