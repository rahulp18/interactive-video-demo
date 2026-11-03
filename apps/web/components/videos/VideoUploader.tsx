"use client";

import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useUploadThing } from "@/lib/uploadthing";
import { isAllowedVideoType, VIDEO_MAX_DURATION_SECONDS } from "@/lib/videos/policy";
import type { VideoRecord } from "@/lib/videos/service";

type Props = {
  /** Optional title for the new video; the file name is used when blank. */
  title?: string;
  /** Prevents choosing a file (e.g. until a required form field is filled). */
  disabled?: boolean;
  /** Called with the persisted database record (not the raw client upload data). */
  onUploaded?: (video: VideoRecord) => void;
};

/** Reads duration from the file's own metadata; rejects if the browser cannot decode it. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    const done = (fn: () => void) => {
      URL.revokeObjectURL(url);
      el.removeAttribute("src");
      fn();
    };
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      done(() =>
        Number.isFinite(el.duration) && el.duration <= VIDEO_MAX_DURATION_SECONDS
          ? resolve(el.duration)
          : reject(new Error("Could not determine a valid video duration.")),
      );
    el.onerror = () => done(() => reject(new Error("This file could not be read as a video.")));
    el.src = url;
  });
}

export function VideoUploader({ title, disabled, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [preparing, setPreparing] = useState(false);

  const { startUpload, isUploading } = useUploadThing("videoUploader", {
    onUploadProgress: setProgress,
    onClientUploadComplete: (res) => {
      // serverData is what onUploadComplete returned after the row was written to Postgres.
      const saved = res[0]?.serverData?.video;
      if (!saved) return setError("Upload finished but the video was not saved.");
      setVideo(saved);
      onUploaded?.(saved);
    },
    onUploadError: (e) => setError(e.message),
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setVideo(null);
    setProgress(0);
    if (!isAllowedVideoType(file.type)) return setError("Unsupported format. Use MP4, WebM or MOV.");
    setPreparing(true);
    try {
      const duration = await readDuration(file);
      await startUpload([file], { duration, ...(title?.trim() && { title: title.trim() }) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const busy = preparing || isUploading;

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="sr-only"
        data-testid="video-file-input"
        onChange={(e) => void handleFile(e.target.files?.[0])}
        disabled={busy || disabled}
      />
      <Button type="button" disabled={busy || disabled} onClick={() => inputRef.current?.click()}>
        {busy ? "Uploading…" : "Choose a video"}
      </Button>
      {isUploading && (
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 w-full rounded bg-muted">
          <div className="h-2 rounded bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {video && (
        <div className="space-y-2" data-testid="upload-result">
          <p className="text-sm">
            Saved <span className="font-medium">{video.title}</span> (id {video.id}, {video.duration.toFixed(1)}s)
          </p>
          <video controls preload="metadata" src={video.fileUrl} className="w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
