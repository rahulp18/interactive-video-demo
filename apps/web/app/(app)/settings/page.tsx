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
      <PageHeader title="Settings" description="Your account and how PARICHAY uses it." />
      <Suspense fallback={<Skeleton className="h-40 max-w-xl rounded-xl" role="status" aria-label="Loading settings" />}>
        <Account />
      </Suspense>
    </>
  );
}

async function Account() {
  const user = await requireCurrentUser();
  return (
    <div className="max-w-xl space-y-6">
      <Card>
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
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium">{user.role === "TEACHER" ? "Teacher" : "Student"}</dd>
          </dl>
        </CardContent>
      </Card>
      {user.role === "TEACHER" && (
        <Card>
          <CardHeader>
            <CardTitle>Privacy and the access log</CardTitle>
            <CardDescription>What happens when you open a child&apos;s report.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>You see only children who have watched or answered your own stories. Every time you open or print a child&apos;s report, your name and the time are written to that child&apos;s access log, which their family can see.</p>
            <p>Your teacher rating counts for 15% of a child&apos;s overall virtue score; the child&apos;s own answers count 60% and a parent&apos;s rating 25%.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
