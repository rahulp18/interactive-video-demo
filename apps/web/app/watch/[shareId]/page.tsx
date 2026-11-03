import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InteractivePlayer } from "@/components/watch/InteractivePlayer";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { withNext } from "@/lib/auth/redirect";
import { getPublicVideo, getViewerAnsweredIds } from "@/lib/watch/service";

// Unlisted: reachable only by whoever has the link, and kept out of search indexes.
export const metadata: Metadata = {
  title: "Watch",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function WatchPage({ params }: PageProps<"/watch/[shareId]">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <Suspense fallback={<WatchSkeleton />}>
        <Watch params={params} />
      </Suspense>
    </main>
  );
}

async function Watch({ params }: Pick<PageProps<"/watch/[shareId]">, "params">) {
  const { shareId } = await params;
  const video = await getPublicVideo(shareId);
  if (!video) notFound();
  const count = video.interactions.length;
  const viewer = await getCurrentUser();
  const answeredIds = viewer ? await getViewerAnsweredIds(viewer.id, shareId) : [];
  const here = `/watch/${shareId}`;
  return (
    <article className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{video.title}</h1>
        {count > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            This video pauses for {count} {count === 1 ? "question" : "questions"} as you watch.
          </p>
        )}
      </header>
      <InteractivePlayer shareId={shareId} src={video.fileUrl} duration={video.duration} interactions={video.interactions} answeredIds={answeredIds} />
      {count > 0 && (
        <aside className="rounded-lg border bg-muted/40 px-4 py-3 text-sm" data-testid="viewer-notice">
          {viewer ? (
            <p>
              Signed in as <span className="font-medium">{viewer.name}</span>. Your answers are saved, and the person who shared this video can see your name, email and answers.
            </p>
          ) : (
            <p>
              <Link href={withNext("/login", here)} className="font-medium underline underline-offset-4">Sign in</Link> or{" "}
              <Link href={withNext("/register", here)} className="font-medium underline underline-offset-4">create an account</Link> to save your answers. Without an account you can still answer, but nothing is recorded.
            </p>
          )}
        </aside>
      )}
    </article>
  );
}

function WatchSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading video">
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="aspect-video w-full rounded-xl" />
    </div>
  );
}
