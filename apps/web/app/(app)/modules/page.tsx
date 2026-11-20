import { BookOpenIcon, UploadIcon, VideoIcon, ListChecksIcon, PlusIcon, RouteIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { ModuleCover } from "@/components/student/ModuleCover";
import { ModuleStatusBadge, VirtuePill } from "@/components/teacher/VirtuePill";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, pluralize } from "@/components/videos/format";
import { requireTeacher } from "@/lib/auth/server";
import { listConvertibleVideos, listTeacherModules, type TeacherModuleRow } from "@/lib/teacher/modules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Story modules" };

export default function ModulesPage() {
  return (
    <>
      <PageHeader
        title="Story modules"
        description="A story module is a video plus its virtues, questions and notes for grown-ups. Publish one to put it in front of children."
        actions={
          <Link href="/modules/new" className={cn(buttonVariants(), "h-10 rounded-xl px-4 font-bold")}>
            <PlusIcon aria-hidden /> New story module
          </Link>
        }
      />
      <Suspense fallback={<ModulesSkeleton />}>
        <ModuleGrid />
      </Suspense>
    </>
  );
}

async function ModuleGrid() {
  const user = await requireTeacher();
  const [modules, unset] = await Promise.all([listTeacherModules(user.id), listConvertibleVideos(user.id)]);
  const pending = unset.length > 0 && (
    <section aria-labelledby="unset-heading" className="rounded-2xl border border-dashed bg-card p-4">
      <h2 id="unset-heading" className="flex items-center gap-2 text-sm font-extrabold">
        <VideoIcon className="size-4 text-muted-foreground" aria-hidden /> Uploaded videos not set up as stories yet
      </h2>
      <ul className="mt-2 divide-y">
        {unset.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold">{v.title}</span>
            <span className="text-muted-foreground">{formatDuration(v.duration)}</span>
            <Link href={`/modules/new?video=${v.id}`} className={buttonVariants({ size: "sm" })}>
              Set up story
            </Link>
            <Link href={`/videos/${v.id}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
              Open
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );

  if (modules.length === 0) {
    return (
      <div className="space-y-5">
        {pending}
        <EmptyState
          icon={<BookOpenIcon className="size-6" aria-hidden />}
          title="No story modules yet"
          description="Upload a story video, then set it up as a module: choose its virtues, add questions with virtue weights, and publish."
          action={
            <Link href="/upload" className={buttonVariants()}>
              <UploadIcon aria-hidden /> Upload a story video
            </Link>
          }
        />
      </div>
    );
  }

  const published = modules.filter((m) => m.status === "PUBLISHED").length;
  const attention = modules.filter(needsAttention).length;
  return (
    <div className="space-y-5">
      {pending}
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground tabular-nums">{published}</strong> published
        </span>
        <span>
          <strong className="text-foreground tabular-nums">{modules.length - published}</strong> {modules.length - published === 1 ? "draft" : "drafts"}
        </span>
        {attention > 0 && (
          <span className="inline-flex items-center gap-1 font-semibold text-warning">
            <TriangleAlertIcon className="size-4" aria-hidden /> {attention} need{attention === 1 ? "s" : ""} attention
          </span>
        )}
      </p>
      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => (
          <li key={m.id}>
            <ModuleCard module={m} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const needsAttention = (m: TeacherModuleRow) => m.questionCount === 0 || m.weightedQuestionCount < m.questionCount || m.textQuestionCount > 0;

function ModuleCard({ module: m }: { module: TeacherModuleRow }) {
  const warn = needsAttention(m);
  return (
    <Card className="h-full gap-0 overflow-hidden pt-0" data-testid="module-card">
      <Link href={`/modules/${m.id}`} aria-label={`Open ${m.title}`} className="relative block outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <ModuleCover virtue={m.primary.slug} className="rounded-none border-0 border-b" muted={m.status === "DRAFT"} />
        <ModuleStatusBadge status={m.status} className="absolute top-3 left-3 bg-card shadow-sm" />
        <span className="absolute top-3 right-3 rounded-full bg-card px-2 py-0.5 text-xs font-bold shadow-sm">Ages {m.ageBand}</span>
      </Link>
      <CardContent className="flex flex-1 flex-col gap-3 pt-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold" title={m.title}>
            <Link href={`/modules/${m.id}`} className="hover:underline">
              {m.title}
            </Link>
          </h2>
          <p className="truncate text-sm text-muted-foreground" title={m.sourceStory}>
            {m.sourceStory} · {formatDuration(m.duration)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <VirtuePill slug={m.primary.slug} name={m.primary.name} />
          {m.secondary.map((v) => (
            <VirtuePill key={v.id} slug={v.slug} name={v.name} className="opacity-80" />
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Questions</dt>
            <ListChecksIcon className="size-4 text-muted-foreground" aria-hidden />
            <dd>
              {pluralize(m.questionCount, "question")}
              {m.questionCount > 0 && m.weightedQuestionCount < m.questionCount && (
                <span className="font-semibold text-warning"> · {m.questionCount - m.weightedQuestionCount} unweighted</span>
              )}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Children</dt>
            <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
            <dd>
              {m.completedCount} finished · {m.startedCount - m.completedCount} watching
            </dd>
          </div>
          <div className="col-span-2 flex items-center gap-1.5">
            <dt className="sr-only">Journey</dt>
            <RouteIcon className="size-4 text-muted-foreground" aria-hidden />
            <dd className="truncate">
              {m.placements.length === 0 ? <span className="text-muted-foreground">Not in a journey</span> : m.placements.map((p) => `${p.journeyTitle} · Level ${p.level}`).join(", ")}
            </dd>
          </div>
        </dl>
        {warn && (
          <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning">
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            {m.questionCount === 0
              ? "No questions yet."
              : m.textQuestionCount > 0
                ? "Has typed-answer questions the children's player can't show."
                : "Some answers have no virtue weights, so they aren't scored."}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Link href={`/modules/${m.id}`} className={buttonVariants({ size: "sm" })}>
            Details
          </Link>
          <Link href={`/videos/${m.videoId}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            <ListChecksIcon aria-hidden /> Questions
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ModulesSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading story modules">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-96 rounded-2xl" />
      ))}
    </div>
  );
}
