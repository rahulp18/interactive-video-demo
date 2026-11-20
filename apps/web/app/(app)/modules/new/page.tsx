import { ArrowLeftIcon, UploadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { ModuleDetailsForm } from "@/components/teacher/modules/ModuleDetailsForm";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireTeacher } from "@/lib/auth/server";
import { listConvertibleVideos, listVirtues } from "@/lib/teacher/modules";

export const metadata: Metadata = { title: "New story module" };

export default function NewModulePage({ searchParams }: PageProps<"/modules/new">) {
  return (
    <>
      <Link href="/modules" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> Story modules
      </Link>
      <PageHeader
        title="New story module"
        description="Pick one of your videos and describe the story: which virtues it teaches, what children will learn, and what grown-ups can talk about afterwards."
      />
      <Suspense fallback={<Skeleton className="h-[40rem] max-w-3xl rounded-2xl" role="status" aria-label="Loading form" />}>
        <NewModule searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewModule({ searchParams }: Pick<PageProps<"/modules/new">, "searchParams">) {
  const user = await requireTeacher();
  const sp = await searchParams;
  const raw = Array.isArray(sp.video) ? sp.video[0] : sp.video;
  const [videos, virtues] = await Promise.all([listConvertibleVideos(user.id), listVirtues()]);
  const wanted = raw && /^\d{1,10}$/.test(raw) ? Number(raw) : null;
  const initialVideoId = videos.some((v) => v.id === wanted) ? wanted : (videos.length === 1 ? videos[0].id : null);

  if (videos.length === 0) {
    return (
      <EmptyState
        icon={<UploadIcon className="size-6" aria-hidden />}
        title="Upload a story video first"
        description="Every video you own is already a story module. Upload a new video, then come back to describe it."
        action={
          <Link href="/upload" className={buttonVariants()}>
            <UploadIcon aria-hidden /> Upload video
          </Link>
        }
      />
    );
  }

  return (
    <Card className="max-w-3xl">
      <CardContent>
        <ModuleDetailsForm
          mode="create"
          virtues={virtues}
          videos={videos}
          initialVideoId={initialVideoId}
          initial={{
            sourceStory: "",
            primaryVirtueId: null,
            secondaryVirtueIds: [],
            ageBand: "8-9",
            learningObjective: "",
            discussionPrompts: [],
            followUpActivity: "",
          }}
        />
      </CardContent>
    </Card>
  );
}
