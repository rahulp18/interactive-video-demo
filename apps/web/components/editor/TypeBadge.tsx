import { CircleHelpIcon, ClipboardListIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InteractionType } from "@/lib/interactions/model";
import { cn } from "@/lib/utils";

export const TYPE_LABEL: Record<InteractionType, string> = { SURVEY: "Survey", QUIZ: "Quiz" };

/** Marker/badge colours per type; used by the timeline, the list and the survey/quiz pages. */
// Theme tokens (teal "info" and amber "warning" from the brand family) so the colours follow the teacher theme.
export const TYPE_DOT: Record<InteractionType, string> = {
  SURVEY: "bg-info",
  QUIZ: "bg-warning",
};

const TYPE_BADGE: Record<InteractionType, string> = {
  SURVEY: "bg-info/12 text-info",
  QUIZ: "bg-warning/12 text-warning",
};

export function TypeBadge({ type, className }: { type: InteractionType; className?: string }) {
  const Icon = type === "SURVEY" ? ClipboardListIcon : CircleHelpIcon;
  return (
    <Badge className={cn(TYPE_BADGE[type], className)}>
      <Icon className="size-3" aria-hidden /> {TYPE_LABEL[type]}
    </Badge>
  );
}
