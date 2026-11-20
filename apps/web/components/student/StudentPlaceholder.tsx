import { CompassIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStudent } from "@/lib/auth/server";

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Shown as an "Open the library" shortcut to the existing Library. */
  libraryLink?: boolean;
};

/**
 * Lightweight stand-in for a student destination whose feature is not built yet. It shows no data on purpose.
 * Access uses the existing student guard (`requireStudent`) because every page must check for itself.
 */
export function StudentPlaceholder({ title, description, icon, libraryLink = false }: Props) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Suspense fallback={<Skeleton className="h-56 rounded-xl" role="status" aria-label="Loading" />}>
        <Guarded title={title} icon={icon} libraryLink={libraryLink} />
      </Suspense>
    </>
  );
}

async function Guarded({ title, icon: Icon, libraryLink }: Pick<Props, "title" | "icon" | "libraryLink">) {
  await requireStudent();
  return (
    <EmptyState
      icon={<Icon className="size-5" aria-hidden />}
      title={`${title} is coming soon`}
      description="This part of PARICHAY is being built. Nothing is lost in the meantime: your answers in the library are still saved."
      action={
        libraryLink ? (
          <Link href="/library" className={buttonVariants({ variant: "outline" })}>
            <CompassIcon aria-hidden /> Open the library
          </Link>
        ) : undefined
      }
    />
  );
}
