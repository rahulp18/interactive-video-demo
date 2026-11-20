"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FieldGroup } from "@/components/ui/field";
import { ApiError, authApi } from "@/lib/auth/client";
import { validateRegister } from "@/lib/auth/forms";
import { withNext } from "@/lib/auth/redirect";
import { RegisterContext } from "./AccountContext";
import { FormError } from "./form-error";
import { PasswordChecklist } from "./PasswordChecklist";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { useAuthForm } from "./use-auth-form";
import { useNextParam } from "./use-next-param";

type Field = "name" | "email" | "password" | "confirmPassword";

/** The two password inputs plus a live checklist. Lives inside the keyed <form>, so it resets with it. */
function PasswordFields({ errors }: { errors: Partial<Record<Field, string>> }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <>
      <TextField
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      <TextField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        onChange={(e) => setConfirm(e.target.value)}
        error={errors.confirmPassword}
      />
      <PasswordChecklist password={password} confirm={confirm} />
    </>
  );
}

export function RegisterForm() {
  const next = useNextParam();
  const form = useAuthForm<Field>();

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
      const user = await authApi.register(values.name, values.email, values.password);
      form.succeed(user.role, { firstTime: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
        form.fail(error, { email: "An account with this email already exists. Try signing in instead." });
      } else {
        form.fail(error);
      }
    }
  }

  return (
    <>
      <RegisterContext />
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
            {form.formError && <FormError message={form.formError} />}
            <TextField id="name" name="name" label="Full name" autoComplete="name" autoFocus error={form.errors.name} />
            <TextField
              id="email"
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              error={form.errors.email}
            />
            <PasswordFields errors={form.errors} />
            <SubmitButton loading={form.submitting} loadingText={form.succeeded ? "Account created. Setting things up…" : "Creating your account…"}>
              Create my account
            </SubmitButton>
          </FieldGroup>
        </fieldset>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={withNext("/login", next)} className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Sign in
        </Link>
      </p>
    </>
  );
}
