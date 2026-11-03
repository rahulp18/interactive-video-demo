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
    <Button type="submit" size="lg" className="w-full" disabled={loading} {...props}>
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
