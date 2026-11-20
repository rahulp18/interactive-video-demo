"use client";

import { PlayerFrame } from "@/components/player/PlayerFrame";
import { usePlayback } from "@/components/player/usePlayback";
import type { PublicInteraction } from "@/lib/watch/service";
import { InteractionOverlay } from "./InteractionOverlay";

type Props = {
  shareId: string;
  src: string;
  duration: number;
  interactions: PublicInteraction[];
  /** Optional: interactions to treat as already done (not asked). */
  answeredIds?: number[];
  /** Whether the viewer is signed in. Only signed-in viewers can answer, so anonymous ones get a sign-in prompt. */
  signedIn?: boolean;
  /** Where the sign-in / register links should return to. */
  returnTo?: string;
};

/**
 * Viewer-facing player for `/watch/[shareId]`. Playback pauses when it reaches an interaction and resumes after it is
 * answered or (when allowed) skipped. The playback core is shared with the student player.
 */
export function InteractivePlayer({ shareId, src, duration, interactions, answeredIds = [], signedIn = false, returnTo }: Props) {
  const [refs, playback] = usePlayback({ durationHint: duration, interactions, answeredIds });
  const { active } = playback;
  return (
    <PlayerFrame
      refs={refs}
      playback={playback}
      src={src}
      interactions={interactions}
      overlay={active && <InteractionOverlay key={active.id} shareId={shareId} interaction={active} signedIn={signedIn} returnTo={returnTo} onDone={playback.finishInteraction} />}
    />
  );
}
