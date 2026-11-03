import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";
import { AuthError } from "@/lib/auth/errors";
import { assertSameOrigin } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/request";
import {
  isAllowedVideoType,
  VIDEO_MAX_FILE_SIZE,
  videoUploadInput,
} from "@/lib/videos/policy";
import { saveUploadedVideo } from "@/lib/videos/service";

const f = createUploadthing();

export const ourFileRouter = {
  videoUploader: f({
    video: { maxFileSize: VIDEO_MAX_FILE_SIZE, maxFileCount: 1, minFileCount: 1 },
  })
    .input(videoUploadInput)
    .middleware(async ({ req, files, input }) => {
      // Runs on our server before any presigned URL is issued. Throwing rejects the upload.
      let user;
      try {
        assertSameOrigin(req);
        user = (await requireUser(req)).user;
      } catch (error) {
        if (error instanceof AuthError) {
          throw new UploadThingError({
            code: "FORBIDDEN",
            message: error.code === "UNAUTHENTICATED" ? "You must be signed in to upload." : error.message,
          });
        }
        throw error;
      }

      // The route config already limits to video/*; this narrows to formats browsers and the mobile app can play.
      if (files.some((file) => !isAllowedVideoType(file.type))) {
        throw new UploadThingError({ code: "BAD_REQUEST", message: "Unsupported video format. Use MP4, WebM or MOV." });
      }

      // Validated by videoUploadInput before middleware runs; the guard also satisfies the (wider) inferred type.
      if (!input) throw new UploadThingError({ code: "BAD_REQUEST", message: "Missing upload details." });

      return { userId: user.id, duration: input.duration, title: input.title };
    })
    .onUploadError(({ error, fileKey }) => {
      // Never log metadata, URLs or messages that might carry user data.
      console.error("Video upload failed:", error.code, fileKey);
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        const video = await saveUploadedVideo(metadata.userId, metadata.duration, file, metadata.title);
        return { video };
      } catch (error) {
        console.error("Video persistence failed:", error instanceof Error ? error.name : typeof error, file.key);
        // Do not leave an orphaned file behind that no database row points at.
        await new UTApi().deleteFiles(file.key).catch(() => {
          console.error("Orphaned upload cleanup failed:", file.key);
        });
        throw new UploadThingError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save the uploaded video." });
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
