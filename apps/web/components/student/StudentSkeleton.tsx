import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder shaped like a student page (title, a hero block and a row of cards). */
export function StudentSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-6">
      <Skeleton className="h-10 w-64 max-w-full rounded-2xl" />
      <Skeleton className="h-44 w-full max-w-3xl rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
