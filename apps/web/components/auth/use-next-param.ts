"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const read = () => new URLSearchParams(window.location.search).get("next");

/**
 * The raw `?next=` value of the current page. Read from the location rather than `useSearchParams()`, which would force
 * a Suspense boundary around the (statically prerendered) auth forms. Server and first client render see null.
 */
export function useNextParam(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
