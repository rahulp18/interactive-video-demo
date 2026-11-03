import { CircleHelpIcon, ClipboardListIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InteractionType } from "@/lib/interactions/model";
import { cn } from "@/lib/utils";

export const TYPE_LABEL: Record<InteractionType, string> = { SURVEY: "Survey", QUIZ: "Quiz" };

/** Marker/badge colours per type; used by the timeline, the list and the survey/quiz pages. */
export const TYPE_DOT: Record<InteractionType, string> = {
  SURVEY: "bg-sky-500 dark:bg-sky-400",
  QUIZ: "bg-amber-500 dark:bg-amber-400",
};

const TYPE_BADGE: Record<InteractionType, string> = {
  SURVEY: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  QUIZ: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
};

export function TypeBadge({ type, className }: { type: InteractionType; className?: string }) {
  const Icon = type === "SURVEY" ? ClipboardListIcon : CircleHelpIcon;
  return (
    <Badge className={cn(TYPE_BADGE[type], className)}>
      <Icon className="size-3" aria-hidden /> {TYPE_LABEL[type]}
    </Badge>
  );
}
