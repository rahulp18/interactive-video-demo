"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { authApi } from "@/lib/auth/client";
import { withNext } from "@/lib/auth/redirect";
import { validateLogin } from "@/lib/auth/forms";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { useAuthForm } from "./use-auth-form";
import { useNextParam } from "./use-next-param";

export function LoginForm() {
  const next = useNextParam();
  const form = useAuthForm<"email" | "password">();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    if (!form.begin(validateLogin({ email, password }))) return;
    try {
      await authApi.login(email, password);
      form.succeed();
    } catch (error) {
      form.fail(error);
      // Never keep a rejected password around; put the cursor back where the user needs to retype it.
      const field = formElement.elements.namedItem("password");
      if (field instanceof HTMLInputElement) field.value = "";
      form.focusField("password");
    }
  }

  return (
    <>
      <form
        key={form.resetKey}
        onSubmit={onSubmit}
        onChange={(e) => e.target instanceof HTMLInputElement && form.clearError(e.target.name)}
        noValidate
        aria-busy={form.submitting}
      >
        <fieldset disabled={form.submitting} className="min-w-0">
          <FieldGroup>
            {form.formError && (
              <Alert variant="destructive">
                <AlertDescription>{form.formError}</AlertDescription>
              </Alert>
            )}
            <TextField
              id="email"
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
              error={form.errors.email}
            />
            <TextField
              id="password"
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              error={form.errors.password}
            />
            <SubmitButton loading={form.submitting} loadingText="Logging in…">
              Log in
            </SubmitButton>
          </FieldGroup>
        </fieldset>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href={withNext("/register", next)} className="font-medium text-foreground underline underline-offset-4">
          Create one
        </Link>
      </p>
    </>
  );
}
