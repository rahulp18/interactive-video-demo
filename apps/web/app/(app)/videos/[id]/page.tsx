import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VideoEditor } from "@/components/editor/VideoEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthError } from "@/lib/auth/errors";
import { requireCurrentUser } from "@/lib/auth/server";
import { isInteractionType } from "@/lib/interactions/model";
import { listVideoInteractions } from "@/lib/interactions/service";
import { getVideo } from "@/lib/videos/service";

export const metadata: Metadata = { title: "Video editor" };

type Props = PageProps<"/videos/[id]">;

export default function VideoEditorPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Editor({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const user = await requireCurrentUser();
  const { id: rawId } = await params;
  const query = await searchParams;

  const id = /^\d{1,10}$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) notFound();

  let loaded;
  try {
    // Both reads are scoped to the signed-in user; someone else's video is indistinguishable from a missing one.
    const video = await getVideo(user.id, id);
    loaded = { video, interactions: await listVideoInteractions(user.id, id) };
  } catch (error) {
    if (error instanceof AuthError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const edit = first(query.edit);
  const newType = first(query.new);
  const time = Number(first(query.t));
  return (
    <VideoEditor
      video={{ id: loaded.video.id, title: loaded.video.title, fileUrl: loaded.video.fileUrl, duration: loaded.video.duration, shareId: loaded.video.shareId, isListed: loaded.video.isListed }}
      initialInteractions={loaded.interactions}
      initial={{
        editId: edit && /^\d+$/.test(edit) ? Number(edit) : undefined,
        newType: isInteractionType(newType) ? newType : undefined,
        time: Number.isFinite(time) ? time : undefined,
        focusTitle: first(query.rename) === "1",
      }}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading editor">
      <Skeleton className="h-9 w-80 max-w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
