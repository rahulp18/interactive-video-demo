"use client";

import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { videosApi } from "@/lib/videos/client";

/** Two-step delete: the first click asks for confirmation inline, the second performs it. */
export function DeleteVideoButton({
  videoId,
  title,
  redirectTo,
  size = "sm",
}: {
  videoId: number;
  title: string;
  /** Where to go after deleting (the editor leaves its own page); otherwise the current list is refreshed. */
  redirectTo?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await videosApi.remove(videoId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the video.");
      setPending(false);
      return;
    }
    if (redirectTo) router.replace(redirectTo);
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size={size} onClick={() => setConfirming(true)} aria-label={`Delete ${title}`}>
        <Trash2Icon aria-hidden /> Delete
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label={`Confirm deleting ${title}`}>
      <span className="text-xs text-muted-foreground">Delete this video and its interactions?</span>
      <Button type="button" variant="destructive" size={size} disabled={pending} onClick={() => void remove()}>
        {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />} Confirm delete
      </Button>
      <Button type="button" variant="ghost" size={size} disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      {error && (
        <span role="alert" className="w-full text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
