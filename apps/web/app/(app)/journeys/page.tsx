import { ChevronRightIcon, InfoIcon, LockIcon, RouteIcon, TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { ModuleStatusBadge, VirtuePill, VirtueTile } from "@/components/teacher/VirtuePill";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireTeacher } from "@/lib/auth/server";
import { listJourneysOverview, type JourneyModuleCell, type JourneyOverview } from "@/lib/teacher/modules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Journeys" };

export default function JourneysPage() {
  return (
    <>
      <PageHeader
        title="Journeys"
        description="How story modules are grouped into paths for children. Level 1 is open; each next level opens once every story in the level before it is finished."
      />
      <Suspense fallback={<JourneysSkeleton />}>
        <Journeys />
      </Suspense>
    </>
  );
}

async function Journeys() {
  const user = await requireTeacher();
  const journeys = await listJourneysOverview(user.id);
  if (journeys.length === 0) {
    return <EmptyState icon={<RouteIcon className="size-6" aria-hidden />} title="No journeys yet" description="Journeys are set up by the PARICHAY content team." />;
  }
  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        Journeys are shared across the platform, so they are read-only here. Stories you own link to their editor.
      </p>
      {journeys.map((j) => (
        <JourneyCard key={j.id} journey={j} />
      ))}
    </div>
  );
}

function JourneyCard({ journey: j }: { journey: JourneyOverview }) {
  const moduleCount = j.levels.reduce((n, l) => n + l.modules.length, 0);
  return (
    <Card data-testid="journey-card">
      <CardHeader className="flex flex-wrap items-start gap-4">
        {j.focus && <VirtueTile slug={j.focus.slug} className="size-14" />}
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="text-xl font-extrabold tracking-tight">{j.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{j.description}</p>
          {j.focus && (
            <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              Focus <VirtuePill slug={j.focus.slug} name={j.focus.name} />
            </p>
          )}
        </div>
        <dl className="flex gap-6 text-center">
          <Stat label="Stories" value={moduleCount} />
          <Stat label="Children started" value={j.learnersStarted} />
          <Stat label="Finished all" value={j.learnersFinished} />
        </dl>
      </CardHeader>
      <CardContent className="space-y-4">
        {j.levels.map((level) => {
          const blocked = j.blockedLevels.includes(level.level);
          return (
            <section key={level.level} aria-label={`Level ${level.level}`} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-extrabold">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground tabular-nums">{level.level}</span>
                Level {level.level}
                {level.level > 1 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <LockIcon className="size-3" aria-hidden /> opens after level {level.level - 1}
                  </span>
                )}
              </h3>
              {blocked && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <TriangleAlertIcon className="size-3.5" aria-hidden /> A story in an earlier level is a draft, so children can&apos;t reach this level yet.
                </p>
              )}
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {level.modules.map((m) => (
                  <li key={m.moduleId}>
                    <ModuleRow m={m} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ModuleRow({ m }: { m: JourneyModuleCell }) {
  const body = (
    <>
      <VirtueTile slug={m.primary.slug} className="size-10 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{m.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <ModuleStatusBadge status={m.status} className="h-5" />
          {m.completedCount} finished · {m.startedCount - m.completedCount} watching
        </span>
      </span>
      {m.mine && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const cls = "flex items-center gap-3 rounded-xl border bg-card p-2.5 text-sm";
  return m.mine ? (
    <Link href={`/modules/${m.moduleId}`} className={cn(cls, "outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

function JourneysSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading journeys">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-72 rounded-2xl" />
      ))}
    </div>
  );
}
