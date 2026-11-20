import { ArrowRightIcon, AwardIcon, PlayIcon, SparklesIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AvatarBubble } from "@/components/student/AvatarBubble";
import { JourneyLinkCard } from "@/components/student/JourneyLinkCard";
import { ModuleCover } from "@/components/student/ModuleCover";
import { progressWords } from "@/components/student/ModuleTile";
import { StudentSkeleton } from "@/components/student/StudentSkeleton";
import { VirtueChip } from "@/components/student/VirtueChip";
import { VirtueTree } from "@/components/student/tree/VirtueTree";
import { buttonVariants } from "@/components/ui/button";
import { requireStudent } from "@/lib/auth/server";
import { getStudentOverview } from "@/lib/learning/overview";
import type { StudentOverview } from "@/lib/learning/overview-types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return (
    <Suspense fallback={<StudentSkeleton label="Loading your home" />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await requireStudent();
  const data = await getStudentOverview(user.id);
  const first = data.student.name.split(" ")[0];
  const isNew = data.storiesFinished === 0 && !data.continue;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <header className="flex items-center gap-4">
        <AvatarBubble avatar={data.student.avatar} name={data.student.name} className="size-16 text-4xl" />
        <h1 className="text-3xl font-extrabold tracking-tight" data-testid="greeting">
          Hi {first}! <span aria-hidden>👋</span>
        </h1>
      </header>

      <Hero data={data} isNew={isNew} />

      <TreePreview data={data} />

      <section aria-labelledby="journeys-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="journeys-heading" className="text-xl font-bold">
            Your journeys
          </h2>
          <Link href="/student/journeys" className="inline-flex min-h-12 items-center gap-1 text-base font-semibold text-primary">
            See all <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {data.journeys.map((j) => (
            <JourneyLinkCard key={j.journeyId} journey={j} showDescription={false} />
          ))}
        </div>
      </section>
    </div>
  );
}

const heroCard = "grid gap-5 rounded-3xl border-2 border-primary/40 bg-card p-4 sm:grid-cols-[minmax(0,16rem)_1fr] sm:p-5";
const coverLink = "rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function Hero({ data, isNew }: { data: StudentOverview; isNew: boolean }) {
  const bigButton = cn(buttonVariants({ size: "lg" }), "h-14 w-full px-8 text-lg font-bold sm:w-auto");
  if (data.continue) {
    const c = data.continue;
    return (
      <section aria-labelledby="hero-heading" className={heroCard} data-testid="continue-card">
        <Link href={`/student/modules/${c.moduleId}`} aria-label={`About ${c.title}`} className={coverLink}>
          <ModuleCover virtue={c.virtues[0]} />
        </Link>
        <div className="flex flex-col justify-center gap-3">
          <h2 id="hero-heading" className="text-2xl font-extrabold">
            Continue your story
          </h2>
          <p className="text-xl font-bold">{c.title}</p>
          <p className="text-base font-semibold text-primary">{progressWords(c.watchedFraction)}</p>
          <div className="flex flex-wrap gap-2">
            {c.virtues.slice(0, 2).map((s) => (
              <VirtueChip key={s} slug={s} />
            ))}
          </div>
          <Link href={`/student/modules/${c.moduleId}/play`} className={bigButton} data-testid="continue-button">
            <PlayIcon aria-hidden /> Continue
          </Link>
        </div>
      </section>
    );
  }
  if (data.upNext) {
    const n = data.upNext;
    return (
      <section aria-labelledby="hero-heading" className={heroCard} data-testid={isNew ? "first-story-card" : "up-next-card"}>
        <Link href={`/student/modules/${n.moduleId}`} aria-label={`About ${n.title}`} className={coverLink}>
          <ModuleCover virtue={n.virtues[0]} />
        </Link>
        <div className="flex flex-col justify-center gap-3">
          <h2 id="hero-heading" className="text-2xl font-extrabold">
            {isNew ? "Welcome to PARICHAY!" : "Up next"}
          </h2>
          {isNew ? (
            <>
              <p className="text-lg text-muted-foreground">Stories, questions and a tree that grows with you. Ready for your first story?</p>
              <p className="text-xl font-bold">{n.title}</p>
            </>
          ) : (
            <p className="text-xl font-bold">{n.title}</p>
          )}
          <Link href={`/student/modules/${n.moduleId}`} className={bigButton} data-testid="start-button">
            <SparklesIcon aria-hidden /> {isNew ? "Start your first story" : "Start this story"}
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="rounded-3xl border-2 border-primary/40 bg-card p-6 text-center" data-testid="all-done-card">
      <p aria-hidden className="text-5xl">
        🎉
      </p>
      <h2 className="mt-2 text-2xl font-extrabold">You finished every story!</h2>
      <p className="mt-1 text-lg text-muted-foreground">Watch your favourites again, or look at your tree.</p>
      <Link href="/student/journeys" className={cn(bigButton, "mt-4")}>
        Visit your journeys
      </Link>
    </section>
  );
}

function TreePreview({ data }: { data: StudentOverview }) {
  return (
    <Link
      href="/student/virtues"
      data-testid="tree-preview"
      className="grid grid-cols-[7rem_1fr] items-center gap-4 rounded-3xl border-2 bg-card p-4 outline-none transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[9rem_1fr]"
    >
      <VirtueTree stage={data.treeStage} branches={data.branches} animate={false} className="max-h-40" />
      <span className="space-y-2">
        <span className="block text-xl font-bold">My Virtue Tree</span>
        <span className="flex items-center gap-1.5 text-lg font-semibold">
          <StarIcon className="size-5 fill-current text-amber-500" aria-hidden />
          {data.totalStars} {data.totalStars === 1 ? "star" : "stars"}
        </span>
        {data.newestBadge && (
          <span className="flex items-center gap-1.5 text-base text-muted-foreground" data-testid="newest-badge">
            <AwardIcon className="size-5 shrink-0 text-primary" aria-hidden /> {data.newestBadge.title}
          </span>
        )}
        {data.totalStars === 0 && <span className="block text-base text-muted-foreground">Finish a story and watch it grow!</span>}
      </span>
    </Link>
  );
}
