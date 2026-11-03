import { VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Preview of the video's own file: the browser decodes a frame near the start (`#t=0.5`), so no thumbnail pipeline
 * is needed. Never autoplays and has no controls.
 */
export function VideoThumb({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-lg bg-muted", className)}>
      <VideoIcon className="absolute inset-0 m-auto size-8 text-muted-foreground/50" aria-hidden />
      <video
        src={`${src}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}
