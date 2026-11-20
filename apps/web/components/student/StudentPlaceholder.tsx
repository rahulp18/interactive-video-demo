import type { LucideIcon } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStudent } from "@/lib/auth/server";

type Props = { title: string; description: string; icon: LucideIcon };

/**
 * Friendly stand-in for a student destination whose feature is not built yet. It shows no data (and so nothing about
 * scores or weaknesses) on purpose. Access uses the student guard because every page must check for itself.
 */
export function StudentPlaceholder({ title, description, icon }: Props) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Suspense fallback={<Skeleton className="h-56 max-w-xl rounded-3xl" role="status" aria-label="Loading" />}>
        <Guarded icon={icon} />
      </Suspense>
    </>
  );
}

async function Guarded({ icon: Icon }: Pick<Props, "icon">) {
  await requireStudent();
  return (
    <div className="flex max-w-xl flex-col items-center rounded-3xl border-2 border-dashed border-primary/40 bg-card px-6 py-12 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-8" aria-hidden />
      </div>
      <h2 className="text-xl font-bold">Coming soon!</h2>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">We are getting this part ready for you. Check back in a little while.</p>
    </div>
  );
}
