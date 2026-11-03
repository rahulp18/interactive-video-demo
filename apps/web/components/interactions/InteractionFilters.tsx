"use client";

import { PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { InteractionType } from "@/lib/interactions/model";

type VideoOption = { id: number; title: string };

/** Search + video filter, kept in the URL so the filtered view is shareable and survives reloads. */
export function InteractionFilters({ videos, q, videoId }: { videos: VideoOption[]; q: string; videoId?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function apply(nextText: string, nextVideo: string) {
    const params = new URLSearchParams();
    if (nextText.trim()) params.set("q", nextText.trim());
    if (nextVideo) params.set("video", nextVideo);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row" role="search">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Search questions"
          placeholder="Search questions…"
          value={text}
          className="h-9 pl-8"
          onChange={(e) => {
            setText(e.target.value);
            clearTimeout(timer.current);
            const value = e.target.value;
            timer.current = setTimeout(() => apply(value, videoId ? String(videoId) : ""), 300);
          }}
        />
      </div>
      <Select
        aria-label="Filter by video"
        value={videoId ? String(videoId) : ""}
        className="h-9 sm:w-64"
        onChange={(e) => apply(text, e.target.value)}
      >
        <option value="">All videos</option>
        {videos.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Creating happens in the video editor (interactions belong to a video); this picks which video to open it on. */
export function NewInteraction({ type, videos, defaultVideoId }: { type: InteractionType; videos: VideoOption[]; defaultVideoId?: number }) {
  const [videoId, setVideoId] = useState(String(defaultVideoId ?? videos[0]?.id ?? ""));
  const label = type === "SURVEY" ? "survey" : "quiz";
  if (videos.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <Select aria-label={`Video for the new ${label}`} value={videoId} onChange={(e) => setVideoId(e.target.value)} className="h-8 w-44">
        {videos.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
      </Select>
      <Link href={`/videos/${videoId}?new=${type}`} className={buttonVariants()}>
        <PlusIcon aria-hidden /> New {label}
      </Link>
    </div>
  );
}
