import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCurrentUser } from "@/lib/auth/server";
import { db } from "@/prisma/db";
import { studentFont } from "@/components/student/student-font";
import { AppFrame } from "./AppFrame";

/** Reads the session on the server and redirects to /login when it is missing, expired or revoked. */
export async function AppShell({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();
  // Students only: the avatar they picked (one small read; never cached, it changes the moment they pick another).
  const avatar = user.role === "STUDENT" ? ((await db.orm.public.User.where({ id: user.id }).first())?.avatar ?? null) : null;
  return (
    <AppFrame
      user={{ name: user.name, email: user.email, role: user.role, avatar }}
      fontClass={studentFont.variable}
    >
      {children}
    </AppFrame>
  );
}

export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-1" role="status" aria-label="Loading">
      <aside className="hidden w-[4.75rem] shrink-0 border-r bg-sidebar px-2 py-4 md:block lg:w-68 lg:px-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-2xl" />
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <div className="h-16 border-b" />
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full max-w-3xl" />
        </div>
      </div>
    </div>
  );
}
