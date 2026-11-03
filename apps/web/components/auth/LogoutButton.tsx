"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  // The dashboard is kept hidden (not unmounted) after navigating away; reset so a later sign-in doesn't show "Logging out…".
  useLayoutEffect(
    () => () => {
      setPending(false);
      setFailed(false);
    },
    [],
  );

  async function onClick() {
    setPending(true);
    setFailed(false);
    try {
      await authApi.logout();
    } catch {
      // Don't navigate away as if signed out when the session may still be live.
      setFailed(true);
      setPending(false);
      return;
    }
    router.replace("/login");
    router.refresh(); // drop cached authenticated payloads from the client router cache
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {failed && (
        <Alert variant="destructive" className="w-auto py-1.5">
          <AlertDescription>Could not log out. Try again.</AlertDescription>
        </Alert>
      )}
      <Button variant="outline" onClick={onClick} disabled={pending}>
        {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
        {pending ? "Logging out…" : "Log out"}
      </Button>
    </div>
  );
}
