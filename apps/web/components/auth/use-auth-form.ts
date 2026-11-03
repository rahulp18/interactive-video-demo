"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/auth/client";
import { hasErrors, type FieldErrors } from "@/lib/auth/forms";

/**
 * Shared state machine for the login/register forms:
 * idle -> (validation errors | submitting) -> (field/form error -> idle | success -> redirect).
 * `submitting` deliberately stays true after success so the form remains locked until the redirect unmounts it.
 */
export function useAuthForm<K extends string>() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false); // synchronous guard: state updates are too late to stop a double Enter/click
  const [errors, setErrors] = useState<FieldErrors<K>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(
    () => () => {
      busy.current = false;
    },
    [],
  );

  const focusField = useCallback((name: string) => {
    const el = formRef.current?.elements.namedItem(name);
    if (el instanceof HTMLElement) el.focus();
  }, []);

  const focusFirstError = useCallback(
    (fieldErrors: FieldErrors<K>) => {
      const first = Object.keys(fieldErrors)[0];
      if (first) focusField(first);
    },
    [focusField],
  );

  /** Resets previous errors and applies client-side ones. Returns true when the request may be sent. */
  function begin(clientErrors: FieldErrors<K>): boolean {
    if (busy.current) return false;
    setFormError(null);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) {
      focusFirstError(clientErrors);
      return false;
    }
    busy.current = true;
    setSubmitting(true);
    return true;
  }

  /** Editing a field dismisses its own error and the form-level banner. Wire to the form's onChange. */
  function clearError(field: string) {
    setFormError(null);
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field as K];
      return next;
    });
  }

  /**
   * Unlocks the form and shows the failure: field errors inline, anything else as a banner.
   * `fieldOverride` lets a caller turn a specific error code into an inline field message.
   */
  function fail(error: unknown, fieldOverride?: FieldErrors<K>) {
    busy.current = false;
    setSubmitting(false);
    const fields = fieldOverride ?? (error instanceof ApiError ? (error.fields as FieldErrors<K> | undefined) : undefined);
    if (fields && hasErrors(fields)) {
      setErrors(fields);
      setFormError(null);
      focusFirstError(fields);
    } else {
      setErrors({});
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  function succeed() {
    router.replace("/dashboard"); // replace: the form must not be reachable via Back
    router.refresh();
  }

  return { formRef, errors, formError, submitting, begin, clearError, fail, succeed, focusField };
}
