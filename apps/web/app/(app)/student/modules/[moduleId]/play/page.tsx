import { LockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ModulePlayer } from "@/components/student/player/StudentPlayer";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStudent } from "@/lib/auth/server";
import { parseId } from "@/lib/api/route";
import { AuthError } from "@/lib/auth/errors";
import { loadPlayerModule } from "@/lib/learning/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Story time", robots: { index: false, follow: false } };

export default function PlayPage({ params }: PageProps<"/student/modules/[moduleId]/play">) {
  return (
    <Suspense fallback={<Skeleton className="aspect-video w-full max-w-4xl rounded-3xl" role="status" aria-label="Loading your story" />}>
      <Play params={params} />
    </Suspense>
  );
}

async function Play({ params }: Pick<PageProps<"/student/modules/[moduleId]/play">, "params">) {
  const user = await requireStudent();
  const { moduleId } = await params;
  let id: number;
  try {
    id = parseId(moduleId, "Story");
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }

  const lookup = await loadPlayerModule(user.id, id);
  if (lookup.status === "missing") notFound();
  if (lookup.status === "locked") return <Locked title={lookup.title} />;

  const { data } = lookup;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight">{data.title}</h1>
        {data.virtues.length > 0 && (
          <ul aria-label="Virtues in this story" className="flex flex-wrap gap-2">
            {data.virtues.map((name) => (
              <li key={name} className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
                {name}
              </li>
            ))}
          </ul>
        )}
      </header>
      <ModulePlayer data={data} />
    </div>
  );
}

function Locked({ title }: { title: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border-2 border-dashed border-primary/40 bg-card px-6 py-12 text-center" data-testid="module-locked">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <LockIcon className="size-8" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">{title} is not open yet</h1>
      <p className="mt-2 max-w-sm text-base text-muted-foreground">Finish the stories before it first, and this one will open up for you.</p>
      <Link href="/student/journeys" className={cn(buttonVariants({ size: "lg" }), "mt-6 h-12 px-6 text-base")}>
        Back to journeys
      </Link>
    </div>
  );
}
