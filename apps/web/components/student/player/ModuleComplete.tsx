"use client";

import { RotateCcwIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ModuleRewards } from "@/lib/learning/types";
import { cn } from "@/lib/utils";

const MAX_STARS_SHOWN = 12;

/**
 * The reward after a story: stars, new badges, "your <virtue> grew" lines (names only), the follow-up activity and
 * where to go next. No scores, percentages, ranks or leaderboards. Animation only when the child allows motion.
 */
export function ModuleComplete({ rewards, title, onRewatch }: { rewards: ModuleRewards; title: string; onRewatch: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const shown = Math.min(rewards.stars, MAX_STARS_SHOWN);
  return (
    <section aria-labelledby="done-title" className="space-y-6 rounded-3xl border-2 border-primary/30 bg-card p-5 text-center sm:p-8" data-testid="module-complete">
      <div className="space-y-2">
        <p aria-hidden className="text-5xl">
          🎉
        </p>
        <h2 id="done-title" ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold outline-none">
          You finished {title}!
        </h2>
      </div>

      <div className="space-y-2">
        <ul aria-label={`${rewards.stars} ${rewards.stars === 1 ? "star" : "stars"} earned`} className="flex flex-wrap items-center justify-center gap-2" data-testid="stars">
          {Array.from({ length: Math.max(shown, 1) }, (_, i) => (
            <li
              key={i}
              aria-hidden
              className={cn("text-5xl", rewards.stars > 0 ? "motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in motion-safe:fill-mode-both" : "opacity-40")}
              style={{ animationDelay: `${i * 150}ms`, animationDuration: "400ms" }}
            >
              ⭐
            </li>
          ))}
        </ul>
        <p className="text-lg font-bold">
          {rewards.stars > 0 ? `${rewards.stars} ${rewards.stars === 1 ? "star" : "stars"} for you!` : "Great watching!"}
        </p>
        {rewards.totalStars > rewards.stars && <p className="text-base text-muted-foreground">{rewards.totalStars} stars in your collection.</p>}
      </div>

      {rewards.badges.length > 0 && (
        <div className="space-y-2" data-testid="new-badges">
          <h3 className="text-lg font-bold">New badges</h3>
          <ul className="flex flex-wrap justify-center gap-2">
            {rewards.badges.map((b) => (
              <li key={b.id} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-base font-semibold text-accent-foreground">
                <span aria-hidden>🏅</span> {b.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rewards.grew.length > 0 && (
        <ul className="space-y-1 text-lg font-semibold" data-testid="grew">
          {rewards.grew.map((name) => (
            <li key={name} className="flex items-center justify-center gap-2">
              <SparklesIcon className="size-5 text-primary" aria-hidden /> Your {name} grew!
            </li>
          ))}
        </ul>
      )}

      <div className="mx-auto max-w-xl rounded-2xl bg-muted/60 p-4 text-left">
        <h3 className="text-lg font-bold">Try this at home</h3>
        <p className="mt-1 text-base">{rewards.followUpActivity}</p>
      </div>

      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
        {rewards.nextModule && (
          <Link href={`/student/modules/${rewards.nextModule.moduleId}`} className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}>
            Next story: {rewards.nextModule.title}
          </Link>
        )}
        <Link
          href={rewards.journey ? `/student/journeys/${rewards.journey.journeyId}` : "/student/journeys"}
          className={cn(buttonVariants({ size: "lg", variant: rewards.nextModule ? "outline" : "default" }), "h-12 px-6 text-base")}
        >
          {rewards.journey ? `Back to ${rewards.journey.title}` : "Back to journeys"}
        </Link>
        <Button type="button" variant="ghost" size="lg" className="h-12 text-base" onClick={onRewatch}>
          <RotateCcwIcon aria-hidden /> Watch it again
        </Button>
      </div>
    </section>
  );
}
