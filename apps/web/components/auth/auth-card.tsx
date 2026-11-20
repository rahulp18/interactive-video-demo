import { StarIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { studentFont } from "@/components/student/student-font";
import { cn } from "@/lib/utils";
import { Mascot } from "@/components/brand/Mascot";

/**
 * Shared frame for the sign-in and sign-up pages, designed for children first: it opts into the PARICHAY theme
 * (`data-audience="student"`: warm tokens, big radius, Nunito, 48px targets), greets with the mascot, and floats bright
 * shapes around a chunky card. Large screens get a sunny panel beside the form; phones get the mascot above it.
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
    <div data-audience="student" className={cn(studentFont.variable, "relative flex min-h-dvh flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]")}>
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(160deg,var(--accent)_0%,color-mix(in_oklch,var(--accent),var(--secondary)_70%)_100%)] text-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <Shapes />
        <Wordmark className="relative" />
        <div className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
          <div className="relative size-56 xl:size-64">
            <div className="absolute inset-x-6 bottom-0 h-6 rounded-full bg-foreground/10 blur-md" />
            <Mascot className="bob relative" />
            <span className="absolute -top-2 -left-10 rotate-[-6deg] rounded-2xl rounded-br-sm border-2 border-foreground/15 bg-card px-4 py-2 text-lg font-extrabold shadow-[0_4px_0_oklch(0.3_0.05_50/0.15)]">Hi there! 👋</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-balance xl:text-5xl">{panelTitle}</h2>
            <p className="text-base leading-relaxed text-foreground/80 xl:text-lg">{panelText}</p>
          </div>
        </div>
        <ul className="relative mx-auto flex flex-wrap justify-center gap-2 text-sm font-bold">
          {["🎬 Watch", "🤔 Think", "✅ Answer", "🌳 Grow"].map((chip) => (
            <li key={chip} className="rounded-full border-2 border-foreground/10 bg-card px-4 py-2 shadow-[0_3px_0_oklch(0.3_0.05_50/0.12)]">
              {chip}
            </li>
          ))}
        </ul>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,var(--accent)_0%,transparent_55%)] lg:bg-none">
        <div className="lg:hidden">
          <Shapes />
        </div>
        <header className="relative flex h-16 items-center px-5 sm:px-8 lg:hidden">
          <Wordmark />
        </header>
        <main className="relative flex flex-1 items-start justify-center px-4 pt-2 pb-10 sm:px-8 lg:items-center lg:py-12">
          <div className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-500">
            <div className="mb-5 flex items-end gap-3 lg:block">
              <div className="size-24 shrink-0 sm:size-28 lg:hidden">
                <Mascot />
              </div>
              <div className="space-y-1.5 pb-1">
                <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h1>
                <p className="text-base text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="rounded-[2rem] border-2 border-border bg-card p-5 text-card-foreground shadow-[0_8px_0_var(--border)] sm:p-7">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Bright floating stars, blobs and dots. Pure decoration, never in the way of content. */
function Shapes() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -top-16 -left-16 size-56 rounded-full bg-secondary opacity-80" />
      <span className="absolute top-[28%] -right-10 size-32 rounded-full bg-primary/15" />
      <span className="absolute -bottom-20 -left-10 size-64 rounded-full bg-(--student-leaf)/20" />
      <StarIcon className="bob absolute top-[14%] right-[12%] size-9 fill-primary text-primary [--r:12deg]" />
      <StarIcon className="bob absolute bottom-[18%] left-[10%] size-7 fill-(--student-leaf) text-(--student-leaf) [--r:-10deg] [animation-delay:-2s]" />
      <StarIcon className="bob absolute top-[46%] left-[6%] size-5 fill-primary text-primary [--r:20deg] [animation-delay:-3s]" />
      <span className="bob absolute right-[8%] bottom-[12%] size-5 rounded-full bg-secondary-foreground/30 [animation-delay:-1s]" />
    </div>
  );
}
