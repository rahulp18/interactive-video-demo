import type { Metadata } from "next";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { WelcomeSteps } from "@/components/onboarding/WelcomeSteps";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { homePathFor, postAuthPath } from "@/lib/auth/roles";
import { requireStudent } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Welcome", robots: { index: false, follow: false } };

export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-8">
        <Wordmark />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-12 sm:items-center sm:px-8">
        <Card className="w-full max-w-xl [--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(8)]">
          <CardContent>
            <Suspense fallback={<WelcomeSkeleton />}>
              <Welcome searchParams={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

async function Welcome({ searchParams }: Pick<PageProps<"/welcome">, "searchParams">) {
  // Students only: anonymous visitors go to /login, anyone else is sent to their own home.
  const user = await requireStudent();
  const raw = (await searchParams).next;
  const next = postAuthPath("STUDENT", typeof raw === "string" ? raw : undefined);
  // "Get started" must lead somewhere real, never back into the welcome step.
  const destination = next.startsWith("/welcome") ? homePathFor("STUDENT") : next;
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  return <WelcomeSteps firstName={firstName} destination={destination} />;
}

function WelcomeSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
