import { ArrowRightIcon, ClipboardListIcon, GraduationCapIcon, PlayCircleIcon, PresentationIcon, TimerIcon, VideoIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withNext } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "PARICHAY | Interactive video learning" },
};

// Both paths reuse the existing auth pages; `next` decides where the user lands after signing in.
const STUDENT_LOGIN = withNext("/login", "/student");
const STUDENT_REGISTER = withNext("/register", "/student");
const TEACHER_LOGIN = withNext("/login", "/dashboard");

const STEPS = [
  { icon: VideoIcon, title: "Watch", text: "Play a video as you normally would." },
  { icon: TimerIcon, title: "It pauses", text: "At set moments the video stops and asks you a question." },
  { icon: ClipboardListIcon, title: "Answer", text: "Answer quizzes and surveys, then carry on watching." },
];

const PATHS = [
  {
    key: "student",
    icon: GraduationCapIcon,
    title: "I’m a student",
    description: "Watch shared videos and answer the questions in them.",
    points: ["Browse the video library", "Answer quizzes and surveys as you watch", "Your answers are saved to your account"],
    login: STUDENT_LOGIN,
    register: STUDENT_REGISTER,
    cta: "Continue as a student",
    primary: true,
  },
  {
    key: "teacher",
    icon: PresentationIcon,
    title: "I’m a teacher",
    description: "Turn your own videos into interactive lessons.",
    points: ["Upload a video", "Add quizzes and surveys at any timestamp", "See who answered what"],
    login: TEACHER_LOGIN,
    register: null,
    cta: "Continue as a teacher",
    primary: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PlayCircleIcon className="size-4" aria-hidden />
          </span>
          PARICHAY
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-14 px-4 pt-8 pb-16 sm:space-y-20 sm:px-6 sm:pt-16">
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Learn by watching, and by answering.</h1>
          <p className="mt-4 text-base text-muted-foreground text-balance sm:text-lg">
            PARICHAY is interactive video learning. Videos pause at set moments for quizzes and surveys, so you take part instead of just watching.
          </p>
        </section>

        <section aria-labelledby="paths-heading">
          <h2 id="paths-heading" className="sr-only">
            Choose how you want to continue
          </h2>
          <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
            {PATHS.map(({ key, icon: Icon, title, description, points, login, register, cta, primary }) => (
              <Card key={key} data-testid={`entry-${key}`} className="h-full">
                <CardHeader>
                  <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <CardTitle className="text-xl">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5">
                  <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
                    {points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-2">
                    <Link href={login} data-testid={`entry-${key}-login`} className={cn(buttonVariants({ variant: primary ? "default" : "outline", size: "lg" }), "w-full")}>
                      {cta} <ArrowRightIcon aria-hidden />
                    </Link>
                    {register ? (
                      <p className="text-center text-sm text-muted-foreground">
                        New here?{" "}
                        <Link href={register} data-testid={`entry-${key}-register`} className="font-medium text-foreground underline underline-offset-4">
                          Create an account
                        </Link>
                      </p>
                    ) : (
                      <p className="text-center text-sm text-muted-foreground">Teacher accounts are not created through public sign-up.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="how-heading" className="mx-auto max-w-3xl">
          <h2 id="how-heading" className="text-center text-lg font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-xl border bg-card p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  {i + 1}. {title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">PARICHAY</footer>
    </div>
  );
}
