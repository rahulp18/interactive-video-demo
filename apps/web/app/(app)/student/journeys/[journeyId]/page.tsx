import { ArrowLeftIcon, LockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModuleTile } from "@/components/student/ModuleTile";
import { StudentSkeleton } from "@/components/student/StudentSkeleton";
import { VirtueIcon } from "@/components/student/VirtueChip";
import { parseId } from "@/lib/api/route";
import { AuthError } from "@/lib/auth/errors";
import { requireStudent } from "@/lib/auth/server";
import { getStudentJourneys } from "@/lib/learning/overview";
import { virtueDisplay } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Journey" };

export default function Page({ params }: PageProps<"/student/journeys/[journeyId]">) {
  return (
    <Suspense fallback={<StudentSkeleton label="Loading journey" />}>
      <Journey params={params} />
    </Suspense>
  );
}

async function Journey({ params }: Pick<PageProps<"/student/journeys/[journeyId]">, "params">) {
  const user = await requireStudent();
  const { journeyId } = await params;
  let id: number;
  try {
    id = parseId(journeyId, "Journey");
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }
  const { journeys } = await getStudentJourneys(user.id);
  const journey = journeys.find((j) => j.journeyId === id);
  if (!journey) notFound();
  const v = virtueDisplay(journey.focusVirtue ?? "");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link href="/student/journeys" className="inline-flex min-h-12 items-center gap-1.5 text-base font-semibold text-primary">
        <ArrowLeftIcon className="size-4" aria-hidden /> All journeys
      </Link>
      <header className="flex items-center gap-4">
        <VirtueIcon slug={journey.focusVirtue ?? ""} className="size-16" />
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight">{journey.title}</h1>
          <p className="text-lg text-muted-foreground">{journey.description}</p>
          <p className="mt-1 text-base font-semibold text-primary">
            {journey.storiesDone} of {journey.storiesTotal} {journey.storiesTotal === 1 ? "story" : "stories"}
          </p>
        </div>
      </header>

      <ol aria-label="Levels">
        {journey.levels.map((level, i) => {
          const last = i === journey.levels.length - 1;
          return (
            <li key={level.level} className="relative flex gap-4 pb-8 last:pb-0" data-testid="journey-level" data-open={level.open}>
              {!last && <span aria-hidden className="absolute top-12 bottom-0 left-6 w-1 -translate-x-1/2 rounded-full bg-border" />}
              <span
                aria-hidden
                className={cn("z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-4 border-background text-lg font-extrabold", level.open ? "text-white" : "bg-muted text-muted-foreground")}
                style={level.open ? { backgroundColor: v.color } : undefined}
              >
                {level.open ? level.level : <LockIcon className="size-5" />}
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex min-h-12 flex-wrap items-center gap-x-3">
                  <h2 className="text-xl font-bold">Level {level.level}</h2>
                  {!level.open && (
                    <p className="text-base font-semibold text-muted-foreground" data-testid="level-locked">
                      Finish Level {Math.max(1, level.level - 1)} to unlock
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {level.modules.map((m) => (
                    <ModuleTile key={m.moduleId} module={m} />
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
