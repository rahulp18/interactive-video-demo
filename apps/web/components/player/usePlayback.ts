"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { PublicInteraction } from "@/lib/watch/service";

const noopSubscribe = () => () => {};
const supportsFullscreen = () => typeof document !== "undefined" && document.fullscreenEnabled === true;

export type PlaybackOptions = {
  durationHint: number;
  interactions: PublicInteraction[];
  /** Interactions to treat as already done (never asked). */
  answeredIds?: number[];
  /** Where playback starts (resume point). */
  startAt?: number;
};

/**
 * The playback core shared by the public `/watch` player and the student player: pause at each interaction, the seek
 * guard, the frame-accurate trigger, replay and full screen. It knows nothing about how an interaction is answered:
 * the caller renders the question for `active` and calls `finishInteraction()` when the viewer may move on.
 *
 * Required interactions cannot be bypassed by seeking: a forward seek past one lands on it.
 */
export function usePlayback({ durationHint, interactions, answeredIds = [], startAt = 0 }: PlaybackOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(new Set<number>(answeredIds));
  const activeRef = useRef<PublicInteraction | null>(null);
  const startedRef = useRef(false);

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

  const seek = useCallback(
    (seconds: number) => {
      const v = videoRef.current;
      if (!v || activeRef.current) return;
      const t = Math.min(Math.max(seconds, 0), v.duration || durationHint);
      v.currentTime = t;
      setTime(t);
      setEnded(false);
    },
    [durationHint],
  );

  /** Starts over and asks every question again (a re-watch). */
  function replayAll() {
    const v = videoRef.current;
    if (!v) return;
    doneRef.current.clear();
    setDoneIds([]);
    setEnded(false);
    v.currentTime = 0;
    setTime(0);
    void v.play().catch(() => setMediaError(true));
  }

  /**
   * "Watch again" for the question on screen: hides it, plays from `from` and lets the normal trigger bring the same
   * question back when playback reaches it. `from` must be before the question (see `replayStart`).
   */
  function replaySegment(from: number) {
    const v = videoRef.current;
    if (!v) return;
    activeRef.current = null;
    setActive(null);
    setEnded(false);
    v.currentTime = from;
    setTime(from);
    void v.play().catch(() => setMediaError(true));
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v || activeRef.current) return;
    if (ended) return replayAll();
    if (v.paused) void v.play().catch(() => setMediaError(true));
    else v.pause();
  }

  /** The viewer is done with the question on screen: mark it done and carry on (or show the next due one). */
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

  /** Handlers for the <video> element. */
  const videoHandlers = {
    onClick: togglePlay,
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setMediaError(false);
      const v = e.currentTarget;
      if (Number.isFinite(v.duration)) setDuration(v.duration);
      if (!startedRef.current && startAt > 0) {
        startedRef.current = true;
        v.currentTime = startAt;
        setTime(startAt);
      }
    },
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => setTime(e.currentTarget.currentTime),
    onSeeked: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setTime(e.currentTarget.currentTime);
      check(e.currentTarget.currentTime, true);
    },
    onEnded: () => {
      setPlaying(false);
      if (!check(videoRef.current?.duration ?? durationHint, false)) setEnded(true);
    },
    onError: () => setMediaError(true),
  };

  // Refs are returned apart from everything else, so reading state in render never looks like reading a ref.
  const refs = { containerRef, videoRef };
  const playback = {
    active,
    doneIds,
    time,
    duration,
    playing,
    muted,
    setMuted,
    ended,
    fullscreen,
    canFullscreen,
    mediaError,
    togglePlay,
    seek,
    replayAll,
    replaySegment,
    finishInteraction,
    toggleFullscreen,
    onKeyDown,
    videoHandlers,
  };
  return [refs, playback] as const;
}

export type PlaybackRefs = { containerRef: RefObject<HTMLDivElement | null>; videoRef: RefObject<HTMLVideoElement | null> };
export type Playback = ReturnType<typeof usePlayback>[1];
