"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerFrame } from "@/components/player/PlayerFrame";
import { usePlayback } from "@/components/player/usePlayback";
import { Button } from "@/components/ui/button";
import { isRetryable, postComplete, putProgress } from "@/lib/learning/client";
import { replayStart } from "@/lib/learning/rules";
import type { ModuleRewards, StudentModuleData } from "@/lib/learning/types";
import { ModuleComplete } from "./ModuleComplete";
import { StudentQuestion } from "./StudentQuestion";

const PROGRESS_EVERY_MS = 10_000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Top level of the player page. Holds the "watch it again" run: a re-watch remounts the player with nothing answered,
 * so every question is asked again and re-answering updates the saved answer (the completion date never moves).
 */
export function ModulePlayer({ data }: { data: StudentModuleData }) {
  const [run, setRun] = useState(0);
  const fresh: StudentModuleData = run === 0 ? data : { ...data, answeredIds: [], resumeSeconds: 0, completed: false };
  return <StudentPlayer key={run} data={fresh} onRewatch={() => setRun((r) => r + 1)} />;
}

function StudentPlayer({ data, onRewatch }: { data: StudentModuleData; onRewatch: () => void }) {
  const { moduleId, interactions } = data;
  const [refs, playback] = usePlayback({ durationHint: data.duration, interactions, answeredIds: data.answeredIds, startAt: data.resumeSeconds });
  const { videoRef } = refs;
  const { active, ended, playing } = playback;

  // Per question: time on screen so far (not counting replays) and how often "Watch again" was used.
  const [stats, setStats] = useState<Record<number, { ms: number; replays: number }>>({});
  const [view, setView] = useState<"watch" | "failed" | "rewards">("watch");
  const [rewards, setRewards] = useState<ModuleRewards | null>(null);

  // ---- progress: about every 10 s while playing, on pause, and when leaving the page
  const played = useRef(false);
  const lastSent = useRef<number | null>(null);
  const sendProgress = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video || !played.current) return;
      const at = Math.round(video.currentTime * 10) / 10;
      if (lastSent.current === at) return;
      lastSent.current = at;
      putProgress(moduleId, at).catch(() => {
        lastSent.current = null; // try again at the next tick
      });
    },
    [moduleId],
  );

  useEffect(() => {
    if (!playing) return;
    played.current = true;
    const video = videoRef.current; // captured: the node is already detached when cleanup runs on unmount
    const timer = setInterval(() => sendProgress(video), PROGRESS_EVERY_MS);
    return () => {
      clearInterval(timer);
      sendProgress(video); // paused, or the page is closing
    };
  }, [playing, sendProgress, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    const onHide = () => sendProgress(video);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [sendProgress, videoRef]);

  // ---- finishing: once the story has ended and nothing is on screen, ask the server to complete the module
  const finish = useCallback(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        setRewards(await postComplete(moduleId));
        setView("rewards");
        return;
      } catch (err) {
        if (!isRetryable(err) || attempt === 3) {
          setView("failed");
          return;
        }
        await wait(1200 * (attempt + 1));
      }
    }
  }, [moduleId]);

  const requested = useRef(false);
  useEffect(() => {
    if (view !== "watch" || !ended || active || requested.current) return;
    requested.current = true; // once per run; the "Try again" button asks again by hand
    void finish();
  }, [view, ended, active, finish]);

  function watchAgain(interactionId: number, visibleMs: number, timestamp: number) {
    setStats((s) => ({ ...s, [interactionId]: { ms: visibleMs, replays: (s[interactionId]?.replays ?? 0) + 1 } }));
    playback.replaySegment(replayStart(timestamp, interactions));
  }

  if (view === "rewards" && rewards) return <ModuleComplete rewards={rewards} title={data.title} onRewatch={onRewatch} />;

  const entry = active ? stats[active.id] : undefined;
  return (
    <div className="space-y-3">
      <PlayerFrame
        variant="student"
        refs={refs}
        playback={playback}
        src={data.videoUrl}
        interactions={interactions}
        seekLabel="Move through the story"
        endedPanel={
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-4 text-center text-white" role="status">
            {view === "failed" ? (
              <>
                <p className="text-lg font-semibold">We could not finish saving your story yet.</p>
                <Button
                  type="button"
                  size="lg"
                  className="h-12 px-6 text-base"
                  onClick={() => {
                    setView("watch");
                    void finish();
                  }}
                >
                  Try again
                </Button>
              </>
            ) : (
              <p className="flex items-center gap-2 text-lg font-semibold">
                <LoaderCircleIcon className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> Collecting your stars…
              </p>
            )}
          </div>
        }
        overlay={
          active && (
            <StudentQuestion
              key={active.id}
              moduleId={moduleId}
              interaction={active}
              priorMs={entry?.ms ?? 0}
              replays={entry?.replays ?? 0}
              getPosition={() => videoRef.current?.currentTime ?? active.timestamp}
              onWatchAgain={(ms) => watchAgain(active.id, ms, active.timestamp)}
              onDone={playback.finishInteraction}
            />
          )
        }
      />
      {data.credit && (
        <p className="text-xs text-muted-foreground" data-testid="clip-credit">
          Video: {data.credit}
        </p>
      )}
    </div>
  );
}
