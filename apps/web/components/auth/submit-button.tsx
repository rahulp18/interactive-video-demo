import { LoaderCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  loading,
  loadingText,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { loading: boolean; loadingText: string }) {
  return (
    <Button type="submit" size="lg" className="mt-1 h-14 w-full rounded-2xl text-lg font-extrabold shadow-[0_5px_0_color-mix(in_oklch,var(--primary),black_35%)] hover:bg-primary active:translate-y-1 active:shadow-none" disabled={loading} {...props}>
      {loading ? (
        <>
          <LoaderCircleIcon className="animate-spin" aria-hidden />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
