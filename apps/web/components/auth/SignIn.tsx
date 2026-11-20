"use client";

import { GraduationCapIcon, PresentationIcon } from "lucide-react";
import { useState } from "react";
import { intendedRoleFor } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { LoginForm } from "./LoginForm";
import { StudentLoginForm } from "./StudentLoginForm";
import { useNextParam } from "./use-next-param";

type Choice = "student" | "grownup";

/**
 * The two ways in. Defaults to the student option unless `?next=` points at a teacher page (then Grown-up / Teacher).
 * Display only: the account itself decides the role after sign-in. `?next=` is handled by useAuthForm in each form.
 */
export function SignIn() {
  const intended = intendedRoleFor(useNextParam());
  const [picked, setPicked] = useState<Choice | null>(null);
  const choice: Choice = picked ?? (intended === "TEACHER" ? "grownup" : "student");

  const option = (value: Choice, label: string, Icon: typeof GraduationCapIcon) => (
    <button
      type="button"
      onClick={() => setPicked(value)}
      aria-pressed={choice === value}
      className={cn(
        "flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-base",
        choice === value ? "border-primary bg-primary/10 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {label}
    </button>
  );

  return (
    <>
      <div role="group" aria-label="Who is signing in?" className="mb-5 grid grid-cols-2 gap-2">
        {option("student", "I’m a student", GraduationCapIcon)}
        {option("grownup", "Grown-up / Teacher", PresentationIcon)}
      </div>
      {choice === "student" ? <StudentLoginForm key="student" /> : <LoginForm key="grownup" />}
    </>
  );
}
