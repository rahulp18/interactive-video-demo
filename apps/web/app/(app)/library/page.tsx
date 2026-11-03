import { CompassIcon, MessageSquareIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoThumb } from "@/components/videos/VideoThumb";
import { formatDate, formatDuration, pluralize } from "@/components/videos/format";
import { requireCurrentUser } from "@/lib/auth/server";
import { listLibrary } from "@/lib/watch/service";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Library" description="Interactive videos shared by members. Watch, answer the questions, and your responses are saved to your account." />
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryGrid />
      </Suspense>
    </>
  );
}

async function LibraryGrid() {
  await requireCurrentUser();
  const videos = await listLibrary();
  if (videos.length === 0) {
    return (
      <EmptyState
        icon={<CompassIcon className="size-5" aria-hidden />}
        title="Nothing here yet"
        description="Videos appear here when their owners choose “List in the Library” in the video editor."
      />
    );
  }
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {videos.map((v) => (
        <li key={v.shareId}>
          <Link href={`/watch/${v.shareId}`} className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50" data-testid="library-card">
            <Card className="h-full overflow-hidden pt-0 transition-colors group-hover:bg-muted/40">
              <VideoThumb src={v.fileUrl} className="rounded-none" />
              <CardContent className="space-y-2">
                <h2 className="truncate font-medium" title={v.title}>
                  {v.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  by {v.author} · {formatDuration(v.duration)} · {formatDate(v.createdAt)}
                </p>
                {v.interactionCount > 0 && (
                  <Badge>
                    <MessageSquareIcon className="size-3" aria-hidden /> {pluralize(v.interactionCount, "question")}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LibrarySkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading library">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-64 rounded-xl" />
      ))}
    </div>
  );
}
