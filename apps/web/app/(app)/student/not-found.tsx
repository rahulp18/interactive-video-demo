import { CompassIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function StudentNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border-2 border-dashed border-primary/40 bg-card px-6 py-12 text-center" data-testid="student-not-found">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <CompassIcon className="size-8" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">We could not find that</h1>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">Maybe it moved, or it is not ready yet. Let us find another story together.</p>
      <Link href="/student/journeys" className={cn(buttonVariants({ size: "lg" }), "mt-6 h-12 px-6 text-base")}>
        Back to journeys
      </Link>
    </div>
  );
}
