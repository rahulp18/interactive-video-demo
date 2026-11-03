import { CheckIcon, CircleHelpIcon, ClipboardListIcon, PencilIcon, SkipForwardIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { TypeBadge } from "@/components/editor/TypeBadge";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, pluralize } from "@/components/videos/format";
import { requireCurrentUser } from "@/lib/auth/server";
import { formatPreciseTimestamp, type InteractionType } from "@/lib/interactions/model";
import { listInteractionsByVideo } from "@/lib/interactions/service";
import { listVideos } from "@/lib/videos/service";
import { InteractionFilters, NewInteraction } from "./InteractionFilters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const COPY = {
  SURVEY: { title: "Surveys", noun: "survey", plural: "surveys", icon: ClipboardListIcon, blurb: "Surveys placed on your videos, grouped by video." },
  QUIZ: { title: "Quizzes", noun: "quiz", plural: "quizzes", icon: CircleHelpIcon, blurb: "Quizzes placed on your videos, grouped by video." },
} as const;

/** Read-only view over existing interactions of one type; editing happens in the video editor. */
export function InteractionsPage({ type, searchParams }: { type: InteractionType; searchParams: SearchParams }) {
  const copy = COPY[type];
  return (
    <>
      <PageHeader title={copy.title} description={copy.blurb} />
      <Suspense fallback={<ViewSkeleton />}>
        <InteractionsView type={type} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InteractionsView({ type, searchParams }: { type: InteractionType; searchParams: SearchParams }) {
  const user = await requireCurrentUser();
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 200) ?? "";
  const rawVideo = Array.isArray(sp.video) ? sp.video[0] : sp.video;
  const videoId = rawVideo && /^\d{1,10}$/.test(rawVideo) ? Number(rawVideo) : undefined;

  const [videos, groups] = await Promise.all([
    listVideos(user.id),
    listInteractionsByVideo(user.id, { type, q, videoId }),
  ]);
  const copy = COPY[type];
  const Icon = copy.icon;
  const filtered = q.trim() !== "" || videoId !== undefined;
  const videoOptions = videos.map((v) => ({ id: v.id, title: v.title }));

  if (videos.length === 0) {
    return (
      <EmptyState
        icon={<Icon className="size-5" aria-hidden />}
        title="Upload a video first"
        description={`${copy.title} are placed on a video's timeline, so you need a video before you can add one.`}
        action={
          <Link href="/upload" className={buttonVariants()}>
            <UploadIcon aria-hidden /> Upload video
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <NewInteraction type={type} videos={videoOptions} defaultVideoId={videoId} />
      </div>
      <InteractionFilters videos={videoOptions} q={q} videoId={videoId} />

      {groups.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<Icon className="size-5" aria-hidden />}
            title={`No matching ${copy.plural}`}
            description="Try a different search or choose another video."
            action={
              <Link href={type === "SURVEY" ? "/surveys" : "/quizzes"} className={buttonVariants({ variant: "outline" })}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Icon className="size-5" aria-hidden />}
            title={`No ${copy.plural} yet`}
            description={`Use “New ${copy.noun}” above, or open a video and add one at any moment.`}
          />
        )
      ) : (
        <div className="space-y-5">
          {groups.map(({ video, interactions }) => (
            <Card key={video.id} data-testid="video-group">
              <CardHeader>
                <CardTitle className="truncate">{video.title}</CardTitle>
                <CardDescription>
                  {formatDuration(video.duration)} · {pluralize(interactions.length, copy.noun, copy.plural)}
                </CardDescription>
                <CardAction>
                  <Link href={`/videos/${video.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open video
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {interactions.map((i) => {
                  const correct = i.answerType === "TEXT" ? (i.correctAnswer ? { text: i.correctAnswer } : undefined) : i.options.find((o) => o.isCorrect);
                  return (
                    <div key={i.id} className="flex items-start gap-3 px-4 py-3" data-testid="interaction-row">
                      <span className="mt-0.5 w-16 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                        {formatPreciseTimestamp(i.timestamp)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium break-words">{i.question}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <TypeBadge type={i.type} />
                          <span>{i.answerType === "TEXT" ? "Text answer" : pluralize(i.options.length, "option")}</span>
                          {correct && (
                            <span className="inline-flex items-center gap-1">
                              <CheckIcon className="size-3 text-emerald-600" aria-hidden /> {correct.text}
                            </span>
                          )}
                          {i.isSkippable && (
                            <span className="inline-flex items-center gap-1">
                              <SkipForwardIcon className="size-3" aria-hidden /> Skippable
                            </span>
                          )}
                        </p>
                      </div>
                      <Link
                        href={`/videos/${video.id}?edit=${i.id}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                        aria-label={`Edit ${copy.noun} at ${formatPreciseTimestamp(i.timestamp)} in ${video.title}`}
                      >
                        <PencilIcon aria-hidden /> Edit
                      </Link>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function ViewSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
