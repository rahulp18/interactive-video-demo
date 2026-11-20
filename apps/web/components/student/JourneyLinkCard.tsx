import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { VirtueIcon } from "@/components/student/VirtueChip";
import type { JourneyCard } from "@/lib/learning/overview-types";
import { virtueDisplay, virtueTint } from "@/lib/virtues/display";

/** A journey in a list: focus virtue icon + colour, title, one line and "3 of 4 stories". */
export function JourneyLinkCard({ journey, showDescription = true }: { journey: JourneyCard; showDescription?: boolean }) {
  const v = virtueDisplay(journey.focusVirtue ?? "");
  return (
    <Link
      href={`/student/journeys/${journey.journeyId}`}
      data-testid="journey-card"
      className="flex min-h-14 items-center gap-4 rounded-3xl border-2 bg-card p-4 outline-none transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      style={{ borderColor: virtueTint(v.color).borderColor }}
    >
      <VirtueIcon slug={journey.focusVirtue ?? ""} className="size-14" />
      <span className="min-w-0 flex-1">
        <span className="block text-lg leading-snug font-bold">{journey.title}</span>
        {showDescription && <span className="mt-0.5 block text-base text-muted-foreground">{journey.description}</span>}
        <span className="mt-1 block text-base font-semibold text-primary">
          {journey.storiesDone} of {journey.storiesTotal} {journey.storiesTotal === 1 ? "story" : "stories"}
        </span>
      </span>
      <ChevronRightIcon className="size-6 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
