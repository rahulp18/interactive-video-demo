import type { Viewport } from "next";
import type { ReactNode } from "react";

// Student pages only: let the bottom tab bar's safe-area padding work on notched phones. Teacher pages are untouched.
export const viewport: Viewport = { viewportFit: "cover" };

export default function StudentLayout({ children }: { children: ReactNode }) {
  return children;
}
