"use client";

import { ArrowLeftIcon, ArrowRightIcon, MessageSquareIcon, PlayCircleIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OVERVIEW = [
  { icon: PlayCircleIcon, title: "Watch interactive videos", text: "Browse the library and play any video shared there." },
  { icon: MessageSquareIcon, title: "Answer as you watch", text: "Videos pause for quizzes and surveys, then carry on." },
  { icon: SaveIcon, title: "Your answers are saved", text: "They are kept on your account." },
];

const HOW_IT_WORKS = [
  "Press play and watch as you normally would.",
  "When a question appears, the video pauses.",
  "Answer to carry on. Some questions can be skipped, and quizzes tell you straight away whether you were right.",
  "Watch again whenever you like. If you answer again, your latest answer is the one that counts.",
];

const STEPS = 2;

/**
 * Two-step first-time welcome. It only explains; nothing is collected because the account already has everything the
 * product uses (name, email), so there is nothing to persist and no "onboarded" flag to keep.
 */
export function WelcomeSteps({ firstName, destination }: { firstName: string; destination: string }) {
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Keyboard and screen-reader users land on the new step's heading instead of being left on a removed button.
  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground" data-testid="welcome-progress">
          Step {step + 1} of {STEPS}
        </p>
        <div className="mt-2 flex gap-2" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      <div key={step} className="space-y-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-300">
        {step === 0 ? (
          <>
            <div className="space-y-2">
              <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-balance outline-none sm:text-4xl">
                Welcome to PARICHAY, {firstName}.
              </h1>
              <p className="text-muted-foreground sm:text-lg">Your account is ready. Here is what you can do.</p>
            </div>
            <ul className="space-y-4">
              {OVERVIEW.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-balance outline-none sm:text-4xl">
                How a video works
              </h1>
              <p className="text-muted-foreground sm:text-lg">That is all the setup you need. There is nothing else to fill in.</p>
            </div>
            <ol className="space-y-4">
              {HOW_IT_WORKS.map((text, i) => (
                <li key={text} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-hidden>
                    {i + 1}
                  </span>
                  <p className="pt-1 text-sm sm:text-base">{text}</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {step === 0 ? (
          <Link href={destination} className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11 sm:h-9")}>
            Skip intro
          </Link>
        ) : (
          <Button type="button" variant="outline" size="lg" className="h-11 sm:h-9" onClick={() => setStep(0)}>
            <ArrowLeftIcon aria-hidden /> Back
          </Button>
        )}
        {step === 0 ? (
          <Button type="button" size="lg" className="h-11 sm:h-9" onClick={() => setStep(1)}>
            Continue <ArrowRightIcon aria-hidden />
          </Button>
        ) : (
          <Link href={destination} className={cn(buttonVariants({ size: "lg" }), "h-11 sm:h-9")} data-testid="welcome-get-started">
            Get started <ArrowRightIcon aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
