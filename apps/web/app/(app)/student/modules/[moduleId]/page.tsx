import { ArrowLeftIcon, LockIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModuleCover } from "@/components/student/ModuleCover";
import { progressWords } from "@/components/student/ModuleTile";
import { StudentSkeleton } from "@/components/student/StudentSkeleton";
import { VirtueChip } from "@/components/student/VirtueChip";
import { buttonVariants } from "@/components/ui/button";
import { parseId } from "@/lib/api/route";
import { AuthError } from "@/lib/auth/errors";
import { requireStudent } from "@/lib/auth/server";
import { getStudentModulePage } from "@/lib/learning/overview";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Story", robots: { index: false, follow: false } };

export default function Page({ params }: PageProps<"/student/modules/[moduleId]">) {
  return (
    <Suspense fallback={<StudentSkeleton label="Loading your story" />}>
      <Module params={params} />
    </Suspense>
  );
}

const bigButton = cn(buttonVariants({ size: "lg" }), "h-14 w-full px-8 text-lg font-bold sm:w-auto");

async function Module({ params }: Pick<PageProps<"/student/modules/[moduleId]">, "params">) {
  const user = await requireStudent();
  const { moduleId } = await params;
  let id: number;
  try {
    id = parseId(moduleId, "Story");
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }
  const data = await getStudentModulePage(user.id, id);
  if (data.status === "missing") notFound();

  const back = data.journey ? { href: `/student/journeys/${data.journey.journeyId}`, label: data.journey.title } : { href: "/student/journeys", label: "All journeys" };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link href={back.href} className="inline-flex min-h-12 items-center gap-1.5 text-base font-semibold text-primary">
        <ArrowLeftIcon className="size-4" aria-hidden /> {back.label}
      </Link>

      <ModuleCover virtue={data.virtues[0]} muted={data.status === "locked"} className="w-full" />

      <header className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{data.title}</h1>
        {data.status === "ok" && <p className="text-lg text-muted-foreground">{data.sourceLine}</p>}
        {data.virtues.length > 0 && (
          <ul aria-label="Virtues in this story" className="flex flex-wrap gap-2">
            {data.virtues.map((s) => (
              <li key={s}>
                <VirtueChip slug={s} />
              </li>
            ))}
          </ul>
        )}
      </header>

      {data.status === "locked" ? (
        <section className="flex flex-col items-center rounded-3xl border-2 border-dashed border-primary/40 bg-card px-6 py-10 text-center" data-testid="module-locked">
          <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <LockIcon className="size-8" aria-hidden />
          </div>
          <h2 className="text-xl font-bold">Not open yet</h2>
          <p className="mt-2 max-w-sm text-lg text-muted-foreground">{data.unlockHint}</p>
          <Link href={back.href} className={cn(bigButton, "mt-5")}>
            Go back to the journey
          </Link>
        </section>
      ) : (
        <>
          <section aria-labelledby="learn-heading" className="rounded-3xl bg-muted/60 p-5">
            <h2 id="learn-heading" className="text-lg font-bold">
              In this story you will learn…
            </h2>
            <p className="mt-1 text-xl" data-testid="you-will-learn">
              {data.youWillLearn}
            </p>
          </section>

          <div className="space-y-2">
            {data.moduleStatus === "in-progress" && <p className="text-lg font-semibold text-primary">{progressWords(data.watchedFraction)}</p>}
            <Link href={`/student/modules/${data.moduleId}/play`} className={bigButton} data-testid="play-button">
              {data.moduleStatus === "completed" ? <RotateCcwIcon aria-hidden /> : <PlayIcon aria-hidden />}
              {data.moduleStatus === "completed" ? "Watch again" : data.moduleStatus === "in-progress" ? "Continue" : "Play"}
            </Link>
          </div>

          {data.followUpActivity && (
            <section aria-labelledby="home-heading" className="rounded-3xl border-2 border-primary/30 bg-card p-5" data-testid="follow-up">
              <h2 id="home-heading" className="text-xl font-bold">
                Try this at home
              </h2>
              <p className="mt-1 text-lg">{data.followUpActivity}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
