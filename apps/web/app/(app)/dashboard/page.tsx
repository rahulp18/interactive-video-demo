import { BarChart3Icon, CircleHelpIcon, ClipboardListIcon, UploadIcon, VideoIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoThumb } from "@/components/videos/VideoThumb";
import { formatDate, formatDuration, pluralize } from "@/components/videos/format";
import { requireCurrentUser } from "@/lib/auth/server";
import { getResponseOverview } from "@/lib/responses/service";
import { getDashboardStats } from "@/lib/videos/service";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="An overview of your interactive videos."
        actions={
          <Link href="/upload" className={buttonVariants()}>
            <UploadIcon aria-hidden /> Upload a video
          </Link>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  const user = await requireCurrentUser();
  const [stats, overview] = await Promise.all([getDashboardStats(user.id), getResponseOverview(user.id)]);
  const responseCount = overview.reduce((n, v) => n + v.responseCount, 0);

  const tiles = [
    { label: "Videos", value: stats.videoCount, href: "/videos", icon: VideoIcon },
    { label: "Surveys", value: stats.surveyCount, href: "/surveys", icon: ClipboardListIcon },
    { label: "Quizzes", value: stats.quizCount, href: "/quizzes", icon: CircleHelpIcon },
    { label: "Responses", value: responseCount, href: "/responses", icon: BarChart3Icon },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Card className="transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <Icon className="size-4" aria-hidden /> Total {label.toLowerCase()}
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums" data-testid={`stat-${label.toLowerCase()}`}>
                  {value}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <section aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-heading" className="text-lg font-semibold tracking-tight">
            Recent videos
          </h2>
          {stats.recent.length > 0 && (
            <Link href="/videos" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          )}
        </div>
        {stats.recent.length === 0 ? (
          <EmptyState
            icon={<VideoIcon className="size-5" aria-hidden />}
            title="No videos yet"
            description="Upload your first video to start adding surveys and quizzes."
            action={
              <Link href="/upload" className={buttonVariants()}>
                <UploadIcon aria-hidden /> Upload a video
              </Link>
            }
          />
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {stats.recent.map((video) => (
                <Link
                  key={video.id}
                  href={`/videos/${video.id}`}
                  className="flex items-center gap-4 px-4 py-3 outline-none first:rounded-t-xl last:rounded-b-xl hover:bg-muted/40 focus-visible:bg-muted/40"
                >
                  <VideoThumb src={video.fileUrl} className="w-24 shrink-0 sm:w-32" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{video.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(video.duration)} · {formatDate(video.createdAt)} · {pluralize(video.interactionCount, "interaction")}
                    </p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
