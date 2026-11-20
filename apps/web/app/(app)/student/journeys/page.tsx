import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyLinkCard } from "@/components/student/JourneyLinkCard";
import { StudentSkeleton } from "@/components/student/StudentSkeleton";
import { requireStudent } from "@/lib/auth/server";
import { getStudentJourneys } from "@/lib/learning/overview";

export const metadata: Metadata = { title: "Journeys" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Journeys</h1>
        <p className="mt-1 text-lg text-muted-foreground">Pick a path and follow the stories.</p>
      </header>
      <Suspense fallback={<StudentSkeleton label="Loading journeys" />}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const user = await requireStudent();
  const { journeys } = await getStudentJourneys(user.id);
  return (
    <div className="space-y-3">
      {journeys.map((j) => (
        <JourneyLinkCard key={j.journeyId} journey={j} />
      ))}
    </div>
  );
}
