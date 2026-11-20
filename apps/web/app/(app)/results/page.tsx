import { AwardIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStudent } from "@/lib/auth/server";

export const metadata: Metadata = { title: "My Results" };

// Placeholder: the results experience is a later phase. The route exists so the student navigation has a real target.
export default function StudentResultsPage() {
  return (
    <>
      <PageHeader title="My Results" />
      <Suspense fallback={<Skeleton className="h-56 rounded-xl" role="status" aria-label="Loading" />}>
        <ResultsPlaceholder />
      </Suspense>
    </>
  );
}

async function ResultsPlaceholder() {
  await requireStudent();
  return (
    <EmptyState
      icon={<AwardIcon className="size-5" aria-hidden />}
      title="Results are coming soon"
      description="This is where you will be able to review your answers. For now, keep watching and answering in the library."
    />
  );
}
