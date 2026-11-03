"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldGroup } from "@/components/ui/field";
import { ApiError, authApi } from "@/lib/auth/client";
import { validateRegister } from "@/lib/auth/forms";
import { withNext } from "@/lib/auth/redirect";
import { PASSWORD_MIN } from "@/lib/auth/validation";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { useAuthForm } from "./use-auth-form";
import { useNextParam } from "./use-next-param";

export function RegisterForm() {
  const next = useNextParam();
  const form = useAuthForm<"name" | "email" | "password" | "confirmPassword">();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    };

    if (!form.begin(validateRegister(values))) return;
    try {
      // Registration also signs the user in: the response sets the HttpOnly session cookie.
      await authApi.register(values.name, values.email, values.password);
      form.succeed();
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
        form.fail(error, { email: "An account with this email already exists." });
      } else {
        form.fail(error);
      }
    }
  }

  return (
    <>
      <form
        key={form.resetKey}
        onSubmit={onSubmit}
        onChange={(e) => {
          if (!(e.target instanceof HTMLInputElement)) return;
          const { name } = e.target;
          form.clearError(name);
          if (name === "password") form.clearError("confirmPassword");
        }}
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
            <TextField id="name" name="name" label="Name" autoComplete="name" autoFocus error={form.errors.name} />
            <TextField
              id="email"
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={form.errors.email}
            />
            <TextField
              id="password"
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              hint={`At least ${PASSWORD_MIN} characters.`}
              error={form.errors.password}
            />
            <TextField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              error={form.errors.confirmPassword}
            />
            <SubmitButton loading={form.submitting} loadingText="Creating account…">
              Create account
            </SubmitButton>
          </FieldGroup>
        </fieldset>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={withNext("/login", next)} className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
