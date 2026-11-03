import { BarChart3Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, pluralize } from "@/components/videos/format";
import { requireCurrentUser } from "@/lib/auth/server";
import { getResponseOverview } from "@/lib/responses/service";

export const metadata: Metadata = { title: "Responses" };

export default function ResponsesPage() {
  return (
    <>
      <PageHeader title="Responses" description="See who answered the surveys and quizzes on your videos, and how." />
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" role="status" aria-label="Loading responses" />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const user = await requireCurrentUser();
  const items = (await getResponseOverview(user.id)).filter((v) => v.interactionCount > 0);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3Icon className="size-5" aria-hidden />}
        title="No interactive videos yet"
        description="Add a survey or quiz to a video, then share it to start collecting responses."
        action={
          <Link href="/videos" className={buttonVariants()}>
            Go to My Videos
          </Link>
        }
      />
    );
  }
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {items.map((v) => (
          <Link
            key={v.id}
            href={`/responses/${v.id}`}
            data-testid="overview-row"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 outline-none first:rounded-t-xl last:rounded-b-xl hover:bg-muted/40 focus-visible:bg-muted/40"
          >
            <div className="min-w-0 flex-1 basis-56">
              <p className="truncate font-medium">{v.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatDuration(v.duration)} · {pluralize(v.interactionCount, "question")}
              </p>
            </div>
            {!v.isShared && <Badge>Not shared yet</Badge>}
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums">{v.respondentCount}</p>
              <p className="text-xs text-muted-foreground">{v.respondentCount === 1 ? "person" : "people"} responded</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
