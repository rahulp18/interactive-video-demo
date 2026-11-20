"use client";

import { MaximizeIcon, MinimizeIcon, PauseIcon, PlayIcon, RotateCcwIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPreciseTimestamp } from "@/lib/interactions/model";
import type { PublicInteraction } from "@/lib/watch/service";
import { cn } from "@/lib/utils";
import type { Playback, PlaybackRefs } from "./usePlayback";

const clock = (s: number) => formatPreciseTimestamp(s).replace(/\.\d$/, "");

type Props = {
  refs: PlaybackRefs;
  playback: Playback;
  src: string;
  interactions: PublicInteraction[];
  /** The question currently on screen (rendered over the video). */
  overlay?: React.ReactNode;
  /** Replaces the default "You reached the end" panel. */
  endedPanel?: React.ReactNode;
  /** "student" draws 48px controls and a thicker bar; "viewer" is the compact public player. */
  variant?: "viewer" | "student";
  /** Extra label for assistive tech on the progress bar. */
  seekLabel?: string;
};

/**
 * The video, its progress bar with question markers and its controls. Pure presentation over `usePlayback`; the
 * public viewer and the student player both render it.
 */
export function PlayerFrame({ refs: { containerRef, videoRef }, playback: p, src, interactions, overlay, endedPanel, variant = "viewer", seekLabel = "Seek" }: Props) {
  const student = variant === "student";
  const pct = (t: number) => (p.duration > 0 ? Math.min(100, Math.max(0, (t / p.duration) * 100)) : 0);

  return (
    <div
      ref={containerRef}
      onKeyDown={p.onKeyDown}
      className={cn("relative overflow-hidden bg-black", p.fullscreen ? "flex h-dvh flex-col" : "rounded-xl shadow-lg")}
      data-testid="watch-player"
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        muted={p.muted}
        disablePictureInPicture
        {...p.videoHandlers}
        className={cn("w-full cursor-pointer bg-black", p.fullscreen ? "min-h-0 flex-1 object-contain" : "aspect-video")}
        data-testid="watch-video"
      />

      {p.ended && !p.active && (
        endedPanel ?? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
            <p className="text-lg font-semibold">You reached the end</p>
            <button
              type="button"
              onClick={p.replayAll}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black outline-none hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-white/60"
            >
              <RotateCcwIcon className="size-4" aria-hidden /> Watch again
            </button>
          </div>
        )
      )}

      {overlay}

      <div className={cn("space-y-2 bg-neutral-950 px-3 pt-2 pb-3 text-white", student && "pt-3")} {...(p.active ? { inert: true } : {})}>
        <div className={cn("relative", student ? "h-8" : "h-5")}>
          <div className={cn("absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-white/20", student ? "h-2.5" : "h-1.5")}>
            <div className="h-full rounded-full bg-white" style={{ width: `${pct(p.time)}%` }} />
          </div>
          {interactions.map((i) => (
            <span
              key={i.id}
              aria-hidden
              data-testid="watch-marker"
              data-done={p.doneIds.includes(i.id)}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                student ? "size-4" : "size-2.5",
                p.doneIds.includes(i.id) ? "border-emerald-400 bg-emerald-400" : "border-amber-300 bg-neutral-950",
              )}
              style={{ left: `${pct(i.timestamp)}%` }}
            />
          ))}
          <input
            type="range"
            aria-label={seekLabel}
            min={0}
            max={p.duration || 1}
            step={0.1}
            value={Math.min(p.time, p.duration || 1)}
            onChange={(e) => p.seek(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none"
          />
        </div>

        <div className="flex items-center gap-1">
          <ControlButton label={p.ended ? "Watch again" : p.playing ? "Pause" : "Play"} onClick={p.togglePlay} testId="watch-play" big={student}>
            {p.ended ? <RotateCcwIcon /> : p.playing ? <PauseIcon /> : <PlayIcon />}
          </ControlButton>
          <ControlButton label={p.muted ? "Unmute" : "Mute"} onClick={() => p.setMuted((m) => !m)} big={student}>
            {p.muted ? <VolumeXIcon /> : <Volume2Icon />}
          </ControlButton>
          <p className="ml-2 font-mono text-xs tabular-nums sm:text-sm" data-testid="watch-time">
            {clock(p.time)} <span className="text-white/50">/</span> {clock(p.duration)}
          </p>
          <div className="ml-auto">
            {p.canFullscreen && (
              <ControlButton label={p.fullscreen ? "Exit full screen" : "Full screen"} onClick={p.toggleFullscreen} big={student}>
                {p.fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
              </ControlButton>
            )}
          </div>
        </div>
      </div>

      {p.mediaError && (
        <Alert variant="destructive" role="alert" className="m-3 w-auto">
          <AlertDescription>This video could not be played. Check your connection and reload the page.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ControlButton({ label, onClick, children, testId, big }: { label: string; onClick: () => void; children: React.ReactNode; testId?: string; big?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded-md outline-none hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/50 [&_svg]:size-5",
        big ? "size-12 [&_svg]:size-6" : "size-9",
      )}
    >
      {children}
    </button>
  );
}
