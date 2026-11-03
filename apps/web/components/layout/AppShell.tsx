import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCurrentUser } from "@/lib/auth/server";
import { AppFrame } from "./AppFrame";

/** Reads the session on the server and redirects to /login when it is missing, expired or revoked. */
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();
  return <AppFrame user={{ name: user.name, email: user.email }}>{children}</AppFrame>;
}

export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-1" role="status" aria-label="Loading">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar p-4 md:block">
        <Skeleton className="h-7 w-40" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <div className="h-14 border-b" />
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full max-w-3xl" />
        </div>
      </div>
    </div>
  );
}
