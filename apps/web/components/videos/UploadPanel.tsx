"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { VideoUploader } from "@/components/videos/VideoUploader";
import { VIDEO_TITLE_MAX } from "@/lib/videos/policy";

/** Title + the existing UploadThing uploader. On success the saved video's editor opens. */
export function UploadPanel() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Field>
        <FieldLabel htmlFor="video-title">Video title</FieldLabel>
        <Input
          id="video-title"
          value={title}
          maxLength={VIDEO_TITLE_MAX}
          placeholder="e.g. Onboarding walkthrough"
          autoComplete="off"
          disabled={savedTitle !== null}
          onChange={(e) => setTitle(e.target.value)}
        />
        <FieldDescription>Required. Choose a file after entering a title; the upload starts right away.</FieldDescription>
      </Field>

      <VideoUploader
        title={title}
        disabled={!title.trim() || savedTitle !== null}
        onUploaded={(video) => {
          setSavedTitle(video.title);
          router.push(`/videos/${video.id}`);
        }}
      />

      {savedTitle !== null && (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2Icon className="size-4" aria-hidden /> Saved “{savedTitle}”. Opening the editor…
        </p>
      )}
    </div>
  );
}
