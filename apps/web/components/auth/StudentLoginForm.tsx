"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { FieldGroup } from "@/components/ui/field";
import { authApi } from "@/lib/auth/client";
import { FormError } from "./form-error";
import { PIN_LENGTH, PinPad } from "./PinPad";
import { TextField } from "./text-field";
import { useAuthForm } from "./use-auth-form";

/** Student sign-in: username + 4-digit PIN pad. Submits by itself on the 4th digit. No pre-filled values, no demo login. */
export function StudentLoginForm() {
  const form = useAuthForm<"username">();
  const [pin, setPin] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Hidden (not unmounted) when navigating away: never keep a typed PIN around.
  useLayoutEffect(() => () => setPin(""), []);

  async function submit(username: string, digits: string) {
    if (!form.begin(username ? {} : { username: "Type your username first." })) {
      setPin("");
      return;
    }
    try {
      const user = await authApi.pinLogin(username, digits);
      form.succeed(user.role);
    } catch (error) {
      form.fail(error);
      setPin("");
    }
  }

  const readUsername = (el: HTMLFormElement) => String(new FormData(el).get("username") ?? "").trim();

  function onPinChange(next: string) {
    setPin(next);
    if (next.length === PIN_LENGTH && formRef.current) void submit(readUsername(formRef.current), next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // Enter in the username box: the PIN pad is next
    const username = readUsername(event.currentTarget);
    if (!username) form.begin({ username: "Type your username first." });
    else document.querySelector<HTMLButtonElement>("[aria-labelledby='pin-label'] button")?.focus();
  }

  return (
    <form
      ref={formRef}
      key={form.resetKey}
      onSubmit={onSubmit}
      onChange={(e) => e.target instanceof HTMLInputElement && form.clearError(e.target.name)}
      noValidate
      aria-busy={form.submitting}
    >
      <fieldset disabled={form.submitting} className="min-w-0">
        <FieldGroup>
          {form.formError && <FormError message={form.formError} />}
          <TextField
            id="username"
            name="username"
            label="Your username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            autoFocus
            className="h-12 text-base"
            error={form.errors.username}
          />
          <PinPad value={pin} onChange={onPinChange} disabled={form.submitting} />
          <p role="status" className="min-h-5 text-center text-sm text-muted-foreground">
            {form.succeeded ? "Signed in. Taking you there…" : form.submitting ? "Checking…" : ""}
          </p>
        </FieldGroup>
      </fieldset>
      <p className="mt-2 text-center text-sm text-muted-foreground">Forgot your username or PIN? Ask a grown-up.</p>
    </form>
  );
}
