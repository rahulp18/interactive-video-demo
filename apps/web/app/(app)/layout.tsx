import { Suspense, type ReactNode } from "react";
import { AppShell, ShellSkeleton } from "@/components/layout/AppShell";

// Every page in this group requires a signed-in user. The session check streams in behind the skeleton.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
