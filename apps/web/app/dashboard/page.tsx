import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <LogoutButton />
      </header>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile />
      </Suspense>
      <p className="mt-6 text-sm text-muted-foreground">Your interactive videos will appear here.</p>
    </main>
  );
}

// Reads the session cookie on the server and redirects to /login when it is missing, expired or revoked.
async function Profile() {
  const user = await requireCurrentUser();
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardDescription>Signed in as</CardDescription>
        <CardTitle className="text-lg">{user.name}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{user.email}</CardContent>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <Card className="mt-8" role="status" aria-label="Loading profile">
      <CardHeader>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-1 h-6 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-56" />
      </CardContent>
    </Card>
  );
}
