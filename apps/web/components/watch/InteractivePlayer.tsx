"use client";

import {
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPreciseTimestamp } from "@/lib/interactions/model";
import type { PublicInteraction } from "@/lib/watch/service";
import { cn } from "@/lib/utils";
import { InteractionOverlay } from "./InteractionOverlay";

type Props = {
  shareId: string;
  src: string;
  duration: number;
  interactions: PublicInteraction[];
  /** Interactions this signed-in viewer already answered earlier; they are not asked again. */
  answeredIds?: number[];
};

const clock = (s: number) => formatPreciseTimestamp(s).replace(/\.\d$/, "");
const noopSubscribe = () => () => {};
const supportsFullscreen = () => typeof document !== "undefined" && document.fullscreenEnabled === true;

/**
 * Viewer-facing player. Playback pauses when it reaches an interaction and resumes after it is answered or (when
 * allowed) skipped. Required interactions cannot be bypassed by seeking: a forward seek past one lands on it.
 */
export function InteractivePlayer({ shareId, src, duration: durationHint, interactions, answeredIds = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(new Set<number>(answeredIds));
  const activeRef = useRef<PublicInteraction | null>(null);

  const [active, setActive] = useState<PublicInteraction | null>(null);
  const [doneIds, setDoneIds] = useState<number[]>(answeredIds);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(durationHint);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const canFullscreen = useSyncExternalStore(noopSubscribe, supportsFullscreen, () => false);

  const present = useCallback((interaction: PublicInteraction) => {
    activeRef.current = interaction;
    setActive(interaction);
    setEnded(false);
    videoRef.current?.pause();
  }, []);

  const markDone = useCallback((id: number) => {
    doneRef.current.add(id);
    setDoneIds([...doneRef.current]);
  }, []);

  /**
   * Shows the next interaction that is due at time `t`. During natural playback every due interaction is shown. After
   * a seek, skippable ones that were jumped over are dropped silently while a required one stops the seek on itself.
   * Returns true when an interaction is now on screen.
   */
  const check = useCallback(
    (t: number, fromSeek: boolean): boolean => {
      if (activeRef.current) return true;
      const passed = interactions.filter((i) => !doneRef.current.has(i.id) && i.timestamp <= t);
      if (passed.length === 0) return false;
      if (!fromSeek) {
        present(passed[0]);
        return true;
      }
      const blocking = passed.find((i) => !i.isSkippable);
      for (const i of passed) if (i.isSkippable && (!blocking || i.timestamp < blocking.timestamp)) markDone(i.id);
      if (!blocking) return false;
      if (videoRef.current) videoRef.current.currentTime = blocking.timestamp;
      setTime(blocking.timestamp);
      present(blocking);
      return true;
    },
    [interactions, present, markDone],
  );

  // Frame-accurate trigger while playing (timeupdate alone fires only a few times per second).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        check(v.currentTime, false);
        setTime((prev) => (Math.abs(prev - v.currentTime) >= 0.1 ? v.currentTime : prev));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, check]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const seek = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v || activeRef.current) return;
    const t = Math.min(Math.max(seconds, 0), v.duration || durationHint);
    v.currentTime = t;
    setTime(t);
    setEnded(false);
  }, [durationHint]);

  function replay() {
    const v = videoRef.current;
    if (!v) return;
    doneRef.current.clear();
    setDoneIds([]);
    setEnded(false);
    v.currentTime = 0;
    setTime(0);
    void v.play().catch(() => setMediaError(true));
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v || activeRef.current) return;
    if (ended) return replay();
    if (v.paused) void v.play().catch(() => setMediaError(true));
    else v.pause();
  }

  function finishInteraction() {
    const v = videoRef.current;
    const current = activeRef.current;
    if (!current || !v) return;
    markDone(current.id);
    activeRef.current = null;
    setActive(null);
    // Several interactions can share a timestamp, and one can sit at the very end of the video.
    if (check(v.currentTime, false)) return;
    if (v.ended || v.currentTime >= (v.duration || durationHint) - 0.05) setEnded(true);
    else void v.play().catch(() => setMediaError(true));
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (active || (e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === " " || e.key.toLowerCase() === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowRight") seek(time + 5);
    else if (e.key === "ArrowLeft") seek(time - 5);
    else if (e.key.toLowerCase() === "m") setMuted((m) => !m);
    else if (e.key.toLowerCase() === "f" && canFullscreen) toggleFullscreen();
  }

  const pct = (t: number) => (duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0);

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className={cn("relative overflow-hidden bg-black", fullscreen ? "flex h-dvh flex-col" : "rounded-xl shadow-lg")}
      data-testid="watch-player"
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        muted={muted}
        disablePictureInPicture
        onClick={togglePlay}
        onLoadedMetadata={(e) => {
          setMediaError(false);
          if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onSeeked={(e) => {
          setTime(e.currentTarget.currentTime);
          check(e.currentTarget.currentTime, true);
        }}
        onEnded={() => {
          setPlaying(false);
          if (!check(videoRef.current?.duration ?? durationHint, false)) setEnded(true);
        }}
        onError={() => setMediaError(true)}
        className={cn("w-full cursor-pointer bg-black", fullscreen ? "min-h-0 flex-1 object-contain" : "aspect-video")}
        data-testid="watch-video"
      />

      {ended && !active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
          <p className="text-lg font-semibold">You reached the end</p>
          <button
            type="button"
            onClick={replay}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black outline-none hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/60"
          >
            <RotateCcwIcon className="size-4" aria-hidden /> Watch again
          </button>
        </div>
      )}

      {active && <InteractionOverlay key={active.id} shareId={shareId} interaction={active} onDone={finishInteraction} />}

      <div className="space-y-2 bg-neutral-950 px-3 pt-2 pb-3 text-white" {...(active ? { inert: true } : {})}>
        <div className="relative h-5">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct(time)}%` }} />
          </div>
          {interactions.map((i) => (
            <span
              key={i.id}
              aria-hidden
              data-testid="watch-marker"
              data-done={doneIds.includes(i.id)}
              className={cn(
                "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                doneIds.includes(i.id) ? "border-emerald-400 bg-emerald-400" : "border-amber-300 bg-neutral-950",
              )}
              style={{ left: `${pct(i.timestamp)}%` }}
            />
          ))}
          <input
            type="range"
            aria-label="Seek"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(time, duration || 1)}
            onChange={(e) => seek(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none"
          />
        </div>

        <div className="flex items-center gap-1">
          <ControlButton label={ended ? "Watch again" : playing ? "Pause" : "Play"} onClick={togglePlay} testId="watch-play">
            {ended ? <RotateCcwIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
          </ControlButton>
          <ControlButton label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeXIcon /> : <Volume2Icon />}
          </ControlButton>
          <p className="ml-2 font-mono text-xs tabular-nums sm:text-sm" data-testid="watch-time">
            {clock(time)} <span className="text-white/50">/</span> {clock(duration)}
          </p>
          <div className="ml-auto">
            {canFullscreen && (
              <ControlButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
                {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
              </ControlButton>
            )}
          </div>
        </div>
      </div>

      {mediaError && (
        <Alert variant="destructive" role="alert" className="m-3 w-auto">
          <AlertDescription>This video could not be played. Check your connection and reload the page.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ControlButton({ label, onClick, children, testId }: { label: string; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-md outline-none hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/50 [&_svg]:size-5"
    >
      {children}
    </button>
  );
}
