"use client";

import { LoaderCircleIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

/**
 * `rail`: icon-only (label read by screen readers) until the `lg` breakpoint, for the collapsed tablet sidebar.
 * `iconOnly`: always just the icon (label still read by screen readers), e.g. inside a profile card.
 */
export function LogoutButton({
  className,
  buttonClassName,
  rail = false,
  iconOnly = false,
  keepIcon = false,
  variant = "outline",
}: {
  /** With `rail`: keep the icon visible beside the label on wide screens. */
  keepIcon?: boolean;
  className?: string;
  buttonClassName?: string;
  rail?: boolean;
  iconOnly?: boolean;
  variant?: "outline" | "ghost";
}) {
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
      <Button variant={variant} className={buttonClassName} onClick={onClick} disabled={pending} title={rail || iconOnly ? "Log out" : undefined}>
        {pending ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden />
        ) : (
          (rail || iconOnly) && <LogOutIcon aria-hidden className={iconOnly || keepIcon ? undefined : "lg:hidden"} />
        )}
        <span className={cn(iconOnly ? "sr-only" : rail && "max-lg:sr-only")}>{pending ? "Logging out…" : "Log out"}</span>
      </Button>
    </div>
  );
}
