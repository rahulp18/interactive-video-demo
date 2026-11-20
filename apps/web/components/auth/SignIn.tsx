"use client";

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

  const option = (value: Choice, label: string, hint: string, emoji: string) => (
    <button
      type="button"
      onClick={() => setPicked(value)}
      aria-pressed={choice === value}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 text-center outline-none transition-all focus-visible:ring-4 focus-visible:ring-ring/40",
        choice === value
          ? "-translate-y-0.5 border-primary bg-accent text-accent-foreground shadow-[0_4px_0_var(--primary)]"
          : "border-border bg-background text-muted-foreground shadow-[0_4px_0_var(--border)] hover:bg-muted hover:text-foreground",
      )}
    >
      <span aria-hidden className="text-3xl leading-none">{emoji}</span>
      <span className="text-base font-extrabold">{label}</span>
      <span className="text-xs font-semibold opacity-80">{hint}</span>
    </button>
  );

  return (
    <>
      <div role="group" aria-label="Who is signing in? Student, or grown-up or teacher" className="mb-6 grid grid-cols-2 gap-3 pb-1">
        {option("student", "I’m a student", "Username + PIN", "🧒")}
        {option("grownup", "Grown-up", "Teacher · email", "🧑‍🏫")}
      </div>
      {choice === "student" ? <StudentLoginForm key="student" /> : <LoginForm key="grownup" />}
    </>
  );
}
