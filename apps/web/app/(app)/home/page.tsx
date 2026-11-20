import { CompassIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStudent } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Home" };

export default function StudentHomePage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 max-w-xl rounded-xl" role="status" aria-label="Loading" />}>
      <StudentHome />
    </Suspense>
  );
}

async function StudentHome() {
  const user = await requireStudent();
  return (
    <>
      <PageHeader title={`Welcome, ${user.name}`} description="Watch interactive videos and answer the questions in them." />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Start learning</CardTitle>
          <CardDescription>Browse the videos shared on PARICHAY. Each one pauses to ask you questions as you watch.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/library" className={buttonVariants({ size: "lg" })}>
            <CompassIcon aria-hidden /> Open the library
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
