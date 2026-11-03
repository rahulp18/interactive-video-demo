import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCurrentUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your account." />
      <Suspense fallback={<Skeleton className="h-40 max-w-xl rounded-xl" role="status" aria-label="Loading settings" />}>
        <Account />
      </Suspense>
    </>
  );
}

async function Account() {
  const user = await requireCurrentUser();
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>You are signed in with this account. Use the sidebar to log out.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[6rem_1fr] gap-y-3 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium break-all">{user.email}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
