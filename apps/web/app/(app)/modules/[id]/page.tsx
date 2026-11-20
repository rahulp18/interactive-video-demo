import { ArrowLeftIcon, ListChecksIcon, PartyPopperIcon, RouteIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModuleCover } from "@/components/student/ModuleCover";
import { ModuleDetailsForm } from "@/components/teacher/modules/ModuleDetailsForm";
import { PublishControl } from "@/components/teacher/modules/PublishControl";
import { ModuleStatusBadge, VirtuePill } from "@/components/teacher/VirtuePill";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, pluralize } from "@/components/videos/format";
import { AuthError } from "@/lib/auth/errors";
import { requireTeacher } from "@/lib/auth/server";
import { getTeacherModule, listVirtues } from "@/lib/teacher/modules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Story module" };

export default function ModulePage({ params, searchParams }: PageProps<"/modules/[id]">) {
  return (
    <Suspense fallback={<ModuleSkeleton />}>
      <ModuleDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ModuleDetail({ params, searchParams }: Pick<PageProps<"/modules/[id]">, "params" | "searchParams">) {
  const user = await requireTeacher();
  const raw = (await params).id;
  const id = /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) notFound();
  const created = (await searchParams).created === "1";

  let mod;
  try {
    mod = await getTeacherModule(user.id, id);
  } catch (error) {
    if (error instanceof AuthError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const virtues = await listVirtues();

  return (
    <>
      <Link href="/modules" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> Story modules
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-5">
        <ModuleCover virtue={mod.primary.slug} className="w-36 shrink-0 sm:w-44" muted={mod.status === "DRAFT"} />
        <div className="min-w-0 flex-1 basis-64">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <ModuleStatusBadge status={mod.status} />
            <span className="text-sm font-semibold text-muted-foreground">Ages {mod.ageBand}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-balance">{mod.title}</h1>
          <p className="mt-1 text-base text-muted-foreground">
            {mod.sourceStory} · {formatDuration(mod.duration)}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <VirtuePill slug={mod.primary.slug} name={mod.primary.name} size="md" />
            {mod.secondary.map((v) => (
              <VirtuePill key={v.id} slug={v.slug} name={v.name} size="md" />
            ))}
          </div>
        </div>
      </div>

      {created && (
        <p role="status" className="mb-6 flex items-start gap-2 rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
          <PartyPopperIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>Story module created as a draft.</strong> Next, open the questions and tag each answer with virtue weights, then publish it here.
          </span>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-xl font-extrabold">Story details</CardTitle>
            <CardDescription>What children see on the story page, and what grown-ups see in the report.</CardDescription>
          </CardHeader>
          <CardContent>
            <ModuleDetailsForm
              key={mod.updatedAt}
              mode="edit"
              moduleId={mod.id}
              virtues={virtues}
              initial={{
                sourceStory: mod.sourceStory,
                primaryVirtueId: mod.primary.id,
                secondaryVirtueIds: mod.secondary.map((v) => v.id),
                ageBand: mod.ageBand,
                learningObjective: mod.learningObjective,
                discussionPrompts: mod.discussionPrompts,
                followUpActivity: mod.followUpActivity,
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-extrabold">{mod.status === "PUBLISHED" ? "Live for children" : "Ready to publish?"}</CardTitle>
            </CardHeader>
            <CardContent>
              <PublishControl
                moduleId={mod.id}
                status={mod.status}
                readiness={mod.readiness}
                journeyNames={[...new Set(mod.placements.map((p) => p.journeyTitle))]}
                completedCount={mod.completedCount}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-extrabold">At a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-2.5 text-sm">
                <Row icon={ListChecksIcon} label="Questions">
                  {pluralize(mod.questionCount, "question")}, {mod.weightedQuestionCount} weighted
                </Row>
                <Row icon={UsersIcon} label="Children">
                  {mod.completedCount} finished, {mod.startedCount - mod.completedCount} still watching
                </Row>
                <Row icon={RouteIcon} label="Journeys">
                  {mod.placements.length === 0 ? "Not in a journey (always open)" : mod.placements.map((p) => `${p.journeyTitle}, level ${p.level}`).join("; ")}
                </Row>
              </dl>
              <div className="grid gap-2">
                <Link href={`/videos/${mod.videoId}`} className={cn(buttonVariants(), "h-10 rounded-xl font-bold")}>
                  <ListChecksIcon aria-hidden /> Edit questions &amp; weights
                </Link>
                {mod.completedCount + mod.startedCount > 0 && (
                  <Link href="/students" className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-xl font-bold")}>
                    <UsersIcon aria-hidden /> See students
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof UsersIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <dt className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

function ModuleSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading story module">
      <Skeleton className="h-28 w-full max-w-xl rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-[40rem] rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
