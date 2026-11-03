import { BarChart3Icon, PencilIcon, PlayIcon, UploadIcon, VideoIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteVideoButton } from "@/components/videos/DeleteVideoButton";
import { VideoThumb } from "@/components/videos/VideoThumb";
import { formatDate, formatDuration, pluralize } from "@/components/videos/format";
import { requireCurrentUser } from "@/lib/auth/server";
import { listVideos } from "@/lib/videos/service";

export const metadata: Metadata = { title: "My Videos" };

export default function VideosPage() {
  return (
    <>
      <PageHeader
        title="My Videos"
        description="Open a video to add surveys and quizzes at specific moments."
        actions={
          <Link href="/upload" className={buttonVariants()}>
            <UploadIcon aria-hidden /> Upload video
          </Link>
        }
      />
      <Suspense fallback={<VideosSkeleton />}>
        <VideoGrid />
      </Suspense>
    </>
  );
}

async function VideoGrid() {
  const user = await requireCurrentUser();
  const videos = await listVideos(user.id);

  if (videos.length === 0) {
    return (
      <EmptyState
        icon={<VideoIcon className="size-5" aria-hidden />}
        title="No videos yet"
        description="Videos you upload will show up here."
        action={
          <Link href="/upload" className={buttonVariants()}>
            <UploadIcon aria-hidden /> Upload your first video
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {videos.map((video) => (
        <li key={video.id}>
          <Card className="h-full overflow-hidden pt-0" data-testid="video-card">
            <Link href={`/videos/${video.id}`} aria-label={`Open ${video.title}`} className="block">
              <VideoThumb src={video.fileUrl} className="rounded-none" />
            </Link>
            <CardContent className="flex flex-1 flex-col gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-medium" title={video.title}>
                  {video.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDuration(video.duration)} · Uploaded {formatDate(video.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{pluralize(video.interactionCount, "interaction")}</Badge>
                  {video.shareId && <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Public link</Badge>}
                </div>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Link href={`/videos/${video.id}`} className={buttonVariants({ size: "sm" })}>
                  <PlayIcon aria-hidden /> Open
                </Link>
                <Link href={`/videos/${video.id}?rename=1`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                  <PencilIcon aria-hidden /> Edit
                </Link>
                <Link href={`/responses/${video.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                  <BarChart3Icon aria-hidden /> Results
                </Link>
                <DeleteVideoButton videoId={video.id} title={video.title} />
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function VideosSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading videos">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-72 rounded-xl" />
      ))}
    </div>
  );
}
