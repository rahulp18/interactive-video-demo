import { PlayIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shared frame for the sign-in and sign-up pages: a brand panel beside the form on large screens, a compact header
 * above it on small ones. Colours come from the existing theme tokens only.
 */
export function AuthCard({
  title,
  description,
  panelTitle,
  panelText,
  children,
}: {
  title: string;
  description: string;
  panelTitle: string;
  panelText: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[5fr_6fr]">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary-foreground/10 blur-3xl" />
        <Wordmark onPrimary className="relative" />
        <div className="relative max-w-md space-y-5">
          <h2 className="text-4xl font-semibold tracking-tight text-balance xl:text-5xl">{panelTitle}</h2>
          <p className="text-base leading-relaxed text-primary-foreground/75 xl:text-lg">{panelText}</p>
        </div>
        <LessonPreview />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center px-4 sm:px-8 lg:hidden">
          <Wordmark />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pt-4 pb-10 sm:px-8 lg:py-12">
          <div className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
            <div className="mb-6 space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
              <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
            </div>
            <Card className="[--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(7)]">
              <CardContent>{children}</CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Decorative, CSS-only picture of what PARICHAY does: a video that pauses on a question. Hidden from assistive tech. */
function LessonPreview() {
  return (
    <div aria-hidden className="relative w-full max-w-md rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-4">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-primary-foreground/10">
        <span className="absolute top-3 left-3 flex size-8 items-center justify-center rounded-full bg-primary-foreground/90 text-primary">
          <PlayIcon className="size-3.5 translate-x-px fill-current" />
        </span>
        <div className="absolute inset-x-3 bottom-3 rounded-lg bg-background p-3 text-foreground shadow-lg">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Quick question</p>
          <p className="mt-0.5 text-sm font-medium">Which answer fits what you just watched?</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
            <span className="rounded-md border px-2 py-1.5">Option A</span>
            <span className="rounded-md border border-foreground bg-foreground/5 px-2 py-1.5 font-medium">Option B</span>
          </div>
        </div>
      </div>
      <div className="relative mt-4 h-1.5 rounded-full bg-primary-foreground/20">
        <div className="h-full w-[58%] rounded-full bg-primary-foreground" />
        <span className="absolute top-1/2 left-[24%] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400" />
        <span className="absolute top-1/2 left-[58%] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 ring-2 ring-primary" />
        <span className="absolute top-1/2 left-[86%] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 bg-primary" />
      </div>
    </div>
  );
}
