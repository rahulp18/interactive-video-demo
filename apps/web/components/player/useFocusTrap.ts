"use client";

import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE = 'input, textarea, button, a[href], [role="slider"], [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus handling: focus moves into the dialog when it opens (to `initial`, else the first control), Tab stays
 * inside it, and focus returns to what had it before when the dialog closes.
 */
export function useFocusTrap(dialogRef: RefObject<HTMLElement | null>, initial = "input, textarea, button") {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>(initial)?.focus();
    return () => previous?.focus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per open
  }, []);

  return function trapTab(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    // `:disabled` also covers controls inside a disabled fieldset, which a plain [disabled] check misses.
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => !el.matches(":disabled"));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
}
