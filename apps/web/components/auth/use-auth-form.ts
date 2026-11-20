"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/auth/client";
import { hasErrors, type FieldErrors } from "@/lib/auth/forms";
import { postAuthPath, welcomePathFor, type UserRole } from "@/lib/auth/roles";
import { useNextParam } from "./use-next-param";

/**
 * Shared state machine for the login forms:
 * idle -> (validation errors | submitting) -> (field/form error -> idle | success -> redirect).
 * `submitting` deliberately stays true after success so the form remains locked until the redirect unmounts it.
 */
export function useAuthForm<K extends string>() {
  const rawNext = useNextParam();
  const busy = useRef(false); // synchronous guard: state updates are too late to stop a double Enter/click
  const [errors, setErrors] = useState<FieldErrors<K>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  // Bumped on reset; the form is keyed by it so uncontrolled inputs (and the password reveal toggle) are cleared too.
  const [resetKey, setResetKey] = useState(0);

  // With cacheComponents, navigating away hides the route (React <Activity>) instead of unmounting it, keeping its
  // state. Effect cleanups run when it is hidden, so reset here: coming back to /login must show a
  // pristine form, never the previous email, password, errors or spinner.
  useLayoutEffect(
    () => () => {
      busy.current = false;
      setSubmitting(false);
      setSucceeded(false);
      setErrors({});
      setFormError(null);
      setResetKey((key) => key + 1);
    },
    [],
  );

  // A disabled input silently refuses focus, and after a failed submit the fieldset stays disabled until React
  // re-renders. So focus now when possible, otherwise remember the field and focus it once the form is enabled again.
  const pendingFocus = useRef<string | null>(null);
  const focusField = useCallback((name: string) => {
    const el = document.getElementById(name); // field ids match their names
    // `:disabled` (not `.disabled`) also covers inputs disabled by their <fieldset>.
    if (el instanceof HTMLInputElement && !el.matches(":disabled")) {
      el.focus();
      pendingFocus.current = null;
    } else {
      pendingFocus.current = name;
    }
  }, []);
  useEffect(() => {
    if (submitting || !pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [submitting]);

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

  /**
   * Role-aware: a validated `?next=` only when this role may open it, otherwise the role's home. `firstTime` (public
   * registration) routes through the welcome step first.
   */
  function succeed(role: UserRole, { firstTime = false } = {}) {
    setSucceeded(true);
    const target = firstTime ? welcomePathFor(role, rawNext) : postAuthPath(role, rawNext);
    // A full page load, not router.replace + router.refresh: two client navigations started together could cancel each
    // other or reuse a router-cache entry made while signed out, leaving a blank page until the next login. A hard
    // navigation always renders the target fresh with the new session cookie, and `replace` keeps the form out of Back.
    window.location.replace(target);
  }

  return { resetKey, errors, formError, submitting, succeeded, begin, clearError, fail, succeed, focusField };
}
