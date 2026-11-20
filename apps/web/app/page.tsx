import { ArrowRightIcon, BarChart3Icon, BookOpenIcon, GraduationCapIcon, PauseIcon, PresentationIcon, ShieldCheckIcon, SproutIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Mascot } from "@/components/brand/Mascot";
import { Wordmark } from "@/components/brand/Wordmark";
import { buttonVariants } from "@/components/ui/button";
import { studentFont } from "@/components/student/student-font";
import { withNext } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "PARICHAY | Interactive video learning" },
};

// Both paths reuse the existing auth pages; `next` decides where the user lands after signing in.
const STUDENT_LOGIN = withNext("/login", "/student");
const TEACHER_LOGIN = withNext("/login", "/dashboard");

const chunky = "h-14 rounded-2xl px-6 text-lg font-extrabold transition-all active:translate-y-1 active:shadow-none";
const primaryBtn = cn(buttonVariants({ size: "lg" }), chunky, "shadow-[0_5px_0_color-mix(in_oklch,var(--primary),black_35%)] hover:bg-primary");
const ghostBtn = cn(buttonVariants({ variant: "outline", size: "lg" }), chunky, "border-2 shadow-[0_5px_0_var(--border)]");

const STEPS = [
  { emoji: "🎬", title: "Watch", text: "Play a short video, just like any other.", tone: "bg-accent text-accent-foreground" },
  { emoji: "✋", title: "It pauses", text: "At just the right moment, the video stops and asks you something.", tone: "bg-secondary text-secondary-foreground" },
  { emoji: "✅", title: "Answer", text: "Pick an answer to a quiz or survey, then keep watching.", tone: "bg-card text-card-foreground" },
  { emoji: "🌳", title: "Grow", text: "Every answer helps your own virtue tree grow.", tone: "bg-(--student-leaf)/15 text-foreground" },
];

const FEATURES = [
  { icon: BookOpenIcon, title: "Learning journeys", text: "Short modules grouped into journeys, so there is always a next step." },
  { icon: SproutIcon, title: "My Virtue Tree", text: "Kindness, honesty, courage and more, shown as a tree that grows with the child." },
  { icon: ShieldCheckIcon, title: "Made for kids", text: "Big buttons, simple words and a username + secret PIN sign-in. No email needed." },
  { icon: BarChart3Icon, title: "A view for grown-ups", text: "A parent-only report, behind a grown-up question, shows progress over time." },
];

export default function LandingPage() {
  return (
    <div data-audience="student" className={cn(studentFont.variable, "relative flex min-h-dvh flex-1 flex-col overflow-x-clip")}>
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[44rem] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_70%_-10%,var(--accent),transparent)]" />
        <span className="absolute -top-24 -left-24 size-80 rounded-full bg-secondary opacity-70" />
        <span className="absolute top-40 -right-20 size-64 rounded-full bg-(--student-leaf)/15" />
      </div>

      <header className="relative z-10 mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Sign in" className="flex items-center gap-2">
          <Link href={TEACHER_LOGIN} className="hidden rounded-xl px-3 py-2 text-sm font-bold text-muted-foreground hover:text-foreground sm:block">
            For teachers
          </Link>
          <Link href={STUDENT_LOGIN} className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-xl px-5 font-extrabold")}>
            Sign in
          </Link>
        </nav>
      </header>

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:pb-24">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border-2 border-primary/20 bg-card px-4 py-1.5 text-sm font-bold text-primary">
              <StarIcon className="size-4 fill-current" aria-hidden /> Interactive video learning
            </p>
            <h1 className="mt-5 text-5xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl xl:text-7xl">
              Videos that <span className="relative whitespace-nowrap text-primary">talk back<Squiggle /></span>.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-balance sm:text-xl lg:mx-0">
              PARICHAY pauses every video for a fun question, so children think, answer and grow their own virtue tree, instead of just watching.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <Link href={STUDENT_LOGIN} data-testid="hero-student" className={primaryBtn}>
                I’m a student <ArrowRightIcon aria-hidden className="size-5" />
              </Link>
              <Link href={TEACHER_LOGIN} data-testid="hero-teacher" className={ghostBtn}>
                I’m a teacher
              </Link>
            </div>
          </div>
          <HeroArt />
        </section>

        {/* How it works */}
        <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="how-heading" className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">How it works</h2>
            <p className="mt-3 text-lg text-muted-foreground">Four easy steps. No instructions needed.</p>
          </div>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ emoji, title, text, tone }, i) => (
              <li key={title} className={cn("relative rounded-[2rem] border-2 border-border p-6 shadow-[0_6px_0_var(--border)]", tone)}>
                <span className="absolute top-4 right-5 text-sm font-extrabold opacity-50">0{i + 1}</span>
                <span aria-hidden className="text-5xl leading-none">{emoji}</span>
                <h3 className="mt-4 text-2xl font-extrabold">{title}</h3>
                <p className="mt-1.5 text-base leading-relaxed opacity-85">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section aria-labelledby="why-heading" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="why-heading" className="mx-auto max-w-2xl text-center text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            Learning that feels like play
          </h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-[2rem] border-2 border-border bg-card p-6">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <Icon className="size-7" aria-hidden />
                </span>
                <div>
                  <h3 className="text-xl font-extrabold">{title}</h3>
                  <p className="mt-1 text-base leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Choose a path */}
        <section aria-labelledby="paths-heading" className="mx-auto w-full max-w-6xl px-4 py-12 pb-20 sm:px-6">
          <h2 id="paths-heading" className="text-center text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">Ready? Pick your path</h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
            <article data-testid="entry-student" className="flex flex-col rounded-[2rem] border-2 border-primary bg-accent p-7 text-accent-foreground shadow-[0_8px_0_var(--primary)]">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-card text-primary"><GraduationCapIcon className="size-7" aria-hidden /></span>
              <h3 className="mt-4 text-3xl font-extrabold">I’m a student</h3>
              <p className="mt-2 flex-1 text-base leading-relaxed">Watch videos, answer the questions inside them and grow your tree.</p>
              <Link href={STUDENT_LOGIN} data-testid="entry-student-login" className={cn(primaryBtn, "mt-6 w-full")}>
                Continue as a student <ArrowRightIcon aria-hidden className="size-5" />
              </Link>
              <p className="mt-4 text-center text-sm font-semibold">New here? Ask your teacher for your username and PIN.</p>
            </article>
            <article data-testid="entry-teacher" className="flex flex-col rounded-[2rem] border-2 border-border bg-card p-7 shadow-[0_8px_0_var(--border)]">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"><PresentationIcon className="size-7" aria-hidden /></span>
              <h3 className="mt-4 text-3xl font-extrabold">I’m a teacher</h3>
              <p className="mt-2 flex-1 text-base leading-relaxed text-muted-foreground">Upload a video, add quizzes and surveys at any moment, and see who answered what.</p>
              <Link href={TEACHER_LOGIN} data-testid="entry-teacher-login" className={cn(ghostBtn, "mt-6 w-full")}>
                Continue as a teacher <ArrowRightIcon aria-hidden className="size-5" />
              </Link>
              <p className="mt-4 text-center text-sm font-semibold text-muted-foreground">Teacher accounts are not created through public sign-up.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t-2 border-border bg-card py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm font-semibold text-muted-foreground sm:flex-row sm:px-6">
          <Wordmark />
          <p>Learn by watching, and by answering.</p>
        </div>
      </footer>
    </div>
  );
}

/** Hand-drawn underline under the headline's key words. Decorative. */
function Squiggle() {
  return (
    <svg aria-hidden viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-2 h-3 w-full">
      <path d="M2 8 C 30 0, 50 12, 80 6 S 130 0, 160 7 S 190 9, 198 4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-(--student-leaf)" />
    </svg>
  );
}

/** Hero picture: the mascot beside a video that has paused on a question. Pure CSS/SVG, hidden from assistive tech. */
function HeroArt() {
  return (
    <div aria-hidden className="relative mx-auto mb-28 w-full max-w-md sm:mb-32 lg:max-w-none">
      <div className="relative rounded-[2rem] border-2 border-border bg-card p-3 shadow-[0_10px_0_var(--border)]">
        <div className="relative aspect-video overflow-hidden rounded-3xl bg-[linear-gradient(135deg,var(--secondary),var(--accent))]">
          <span className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-full bg-card text-primary shadow">
            <PauseIcon className="size-4 fill-current" />
          </span>
          <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-card p-4 text-card-foreground shadow-xl">
            <p className="text-xs font-extrabold tracking-wide text-primary uppercase">Quick question</p>
            <p className="mt-1 text-base font-extrabold">What should you do when a friend feels sad?</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
              <span className="rounded-xl border-2 px-3 py-2">Walk away</span>
              <span className="rounded-xl border-2 border-primary bg-accent px-3 py-2 text-accent-foreground">Be kind 💛</span>
            </div>
          </div>
        </div>
        <div className="mx-2 mt-4 mb-1 h-2 rounded-full bg-muted">
          <div className="relative h-full w-[56%] rounded-full bg-primary">
            <span className="absolute top-1/2 -right-1.5 size-4 -translate-y-1/2 rounded-full border-2 border-card bg-primary" />
          </div>
        </div>
      </div>
      <div className="bob absolute -bottom-28 left-4 size-32 sm:-bottom-32 sm:left-8 sm:size-40">
        <Mascot />
      </div>
      <span className="bob absolute -top-5 -right-2 rotate-6 rounded-2xl rounded-bl-sm border-2 border-border bg-card px-4 py-2 text-base font-extrabold shadow-[0_4px_0_var(--border)] [animation-delay:-2s]">
        +1 🌱 Kindness!
      </span>
    </div>
  );
}
