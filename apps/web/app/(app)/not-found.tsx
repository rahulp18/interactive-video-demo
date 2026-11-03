import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <SearchXIcon className="mb-3 size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-base font-medium">Not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">This page does not exist, or you do not have access to it.</p>
      <Link href="/videos" className={buttonVariants({ className: "mt-5" })}>
        Back to My Videos
      </Link>
    </div>
  );
}
