"use client";

import { PrinterIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Opens every "examples" disclosure before printing (closed <details> would print empty) and puts them back after.
 * `onPrint` is the page's server action that writes REPORT_PRINT to the access log.
 */
export function PrintButton({ onPrint }: { onPrint: () => Promise<void> }) {
  useEffect(() => {
    let reopened: HTMLDetailsElement[] = [];
    const before = () => {
      reopened = [...document.querySelectorAll<HTMLDetailsElement>(".adult-report details:not([open])")];
      reopened.forEach((d) => (d.open = true));
    };
    const after = () => {
      reopened.forEach((d) => (d.open = false));
      reopened = [];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        void onPrint();
        window.print();
      }}
    >
      <PrinterIcon aria-hidden /> Print / Save as PDF
    </Button>
  );
}
