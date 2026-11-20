import { PlayCircleIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Text-based PARICHAY identity (there is no logo asset): the product's play-icon badge plus the name. */
export function Wordmark({ onPrimary = false, className }: { onPrimary?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      aria-label="PARICHAY home"
      className={cn("inline-flex items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
    >
      <span className={cn("flex size-8 items-center justify-center rounded-lg", onPrimary ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground")}>
        <PlayCircleIcon className="size-4.5" aria-hidden />
      </span>
      PARICHAY
    </Link>
  );
}
