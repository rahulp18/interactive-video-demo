"use client";

import { PresentationIcon } from "lucide-react";
import { intendedRoleFor } from "@/lib/auth/roles";
import { useNextParam } from "./use-next-param";

/** Registration always makes a student account; the page title says so, this covers where teachers come from. */
export function RegisterContext() {
  const role = intendedRoleFor(useNextParam());
  if (role === "TEACHER") {
    return (
      <div className="mb-4 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm" data-testid="register-context">
        <p className="flex items-center gap-2 font-medium">
          <PresentationIcon className="size-4" aria-hidden /> Looking for a teacher account?
        </p>
        <p className="mt-0.5 text-muted-foreground">
          This sign-up only creates student accounts. Teacher accounts are set up by an administrator, so use Sign in if you already have one.
        </p>
      </div>
    );
  }
  return (
    <p className="mb-5 text-sm text-muted-foreground" data-testid="register-context">
      Student accounts can watch videos and answer their questions. Teacher accounts are set up by an administrator.
    </p>
  );
}
