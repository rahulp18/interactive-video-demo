import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadPanel } from "@/components/videos/UploadPanel";
import { requireCurrentUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Upload Video" };

export default function UploadPage() {
  return (
    <>
      <PageHeader title="Upload Video" description="Add a video, then place surveys and quizzes on its timeline." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>New video</CardTitle>
          <CardDescription>MP4, WebM or MOV, up to 512 MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-40 w-full" role="status" aria-label="Loading uploader" />}>
            <UploadForm />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}

// The uploader depends on the signed-in user (UploadThing authorizes against the same session), so it renders per request.
async function UploadForm() {
  await requireCurrentUser();
  return <UploadPanel />;
}
