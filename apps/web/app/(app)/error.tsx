"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-destructive/30 px-6 py-14 text-center">
      <AlertTriangleIcon className="mb-3 size-8 text-destructive" aria-hidden />
      <h2 className="text-base font-medium">Something went wrong</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">We could not load this page. Try again in a moment.</p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
