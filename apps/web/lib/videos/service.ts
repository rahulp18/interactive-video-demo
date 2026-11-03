import "server-only";
import { db } from "@/prisma/db";
import { UTApi } from "uploadthing/server";
import { AuthError } from "@/lib/auth/errors";
import { isUniqueViolation } from "@/lib/auth/service";
import { titleFromFilename, VIDEO_TITLE_MAX } from "./policy";

export type VideoRecord = {
  id: number;
  title: string;
  fileUrl: string;
  duration: number;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  /** Token of the public watch link, or null while the video is private. */
  shareId: string | null;
  /** Shown in the platform Library (requires shareId). */
  isListed: boolean;
  createdAt: string;
};

type Row = {
  id: number; title: string; fileUrl: string; duration: number; mimeType: string;
  originalName: string; sizeBytes: number; shareId: string | null; isListed: boolean; createdAt: Date;
};

const toRecord = (v: Row): VideoRecord => ({
  id: v.id, title: v.title, fileUrl: v.fileUrl, duration: v.duration, mimeType: v.mimeType,
  originalName: v.originalName, sizeBytes: v.sizeBytes, shareId: v.shareId, isListed: v.isListed, createdAt: v.createdAt.toISOString(),
});

export type UploadedFile = { key: string; name: string; size: number; type: string; ufsUrl: string };

/**
 * Persists a finished upload. Idempotent on the UploadThing file key: a repeated completion callback returns the
 * existing row. The uploader is the one fixed in the authenticated middleware, never anything from the client.
 */
export async function saveUploadedVideo(
  userId: number,
  duration: number,
  file: UploadedFile,
  title?: string,
): Promise<VideoRecord> {
  const existing = await db.orm.public.Video.where({ fileKey: file.key }).first();
  if (existing) return toRecord(existing);

  try {
    const video = await db.orm.public.Video.create({
      title: title ?? titleFromFilename(file.name),
      fileUrl: file.ufsUrl,
      duration,
      mimeType: file.type,
      originalName: file.name,
      sizeBytes: file.size,
      fileKey: file.key,
      uploaderId: userId,
    });
    return toRecord(video);
  } catch (error) {
    // Two concurrent callbacks for the same file: the loser reads the winner's row.
    if (isUniqueViolation(error)) {
      const winner = await db.orm.public.Video.where({ fileKey: file.key }).first();
      if (winner) return toRecord(winner);
    }
    throw error;
  }
}

export type VideoListItem = VideoRecord & { interactionCount: number };

/** The signed-in user's videos, newest first. Scoped by uploader in the query itself. */
export async function listVideos(userId: number): Promise<VideoListItem[]> {
  const rows = await db.orm.public.Video.where({ uploaderId: userId })
    .orderBy([(v) => v.createdAt.desc(), (v) => v.id.desc()])
    .include("interactions", (i) => i.count())
    .all();
  return rows.map((v) => ({ ...toRecord(v), interactionCount: v.interactions }));
}

/** One video, or NOT_FOUND. A video owned by someone else is indistinguishable from a missing one. */
export async function getVideo(userId: number, videoId: number): Promise<VideoRecord> {
  const row = await db.orm.public.Video.where({ id: videoId, uploaderId: userId }).first();
  if (!row) throw new AuthError("NOT_FOUND", "Video not found.");
  return toRecord(row);
}

export function parseVideoTitle(body: unknown): string {
  const raw = typeof body === "object" && body !== null ? (body as { title?: unknown }).title : undefined;
  const title = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new AuthError("VALIDATION_ERROR", "Invalid request.", { title: "Title is required." });
  if (title.length > VIDEO_TITLE_MAX) {
    throw new AuthError("VALIDATION_ERROR", "Invalid request.", { title: `Title must be at most ${VIDEO_TITLE_MAX} characters.` });
  }
  return title;
}

export async function updateVideoTitle(userId: number, videoId: number, body: unknown): Promise<VideoRecord> {
  const title = parseVideoTitle(body);
  const row = await db.orm.public.Video.where({ id: videoId, uploaderId: userId }).update({ title });
  if (!row) throw new AuthError("NOT_FOUND", "Video not found.");
  return toRecord(row);
}

/** Deletes the row (interactions, options and responses cascade), then the stored file on a best-effort basis. */
export async function deleteVideo(userId: number, videoId: number): Promise<void> {
  const video = await db.orm.public.Video.where({ id: videoId, uploaderId: userId }).first();
  if (!video) throw new AuthError("NOT_FOUND", "Video not found.");
  await db.orm.public.Video.where({ id: videoId, uploaderId: userId }).deleteAll();
  await new UTApi().deleteFiles(video.fileKey).catch(() => {
    console.error("Stored file cleanup failed:", video.fileKey);
  });
}

export type DashboardStats = {
  videoCount: number;
  surveyCount: number;
  quizCount: number;
  recent: VideoListItem[];
};

export async function getDashboardStats(userId: number, recentLimit = 5): Promise<DashboardStats> {
  const rows = await db.orm.public.Video.where({ uploaderId: userId })
    .orderBy([(v) => v.createdAt.desc(), (v) => v.id.desc()])
    .include("interactions", (i) => i.select("type"))
    .all();
  let surveyCount = 0;
  let quizCount = 0;
  for (const v of rows) {
    for (const i of v.interactions) {
      if (i.type === "SURVEY") surveyCount++;
      else quizCount++;
    }
  }
  return {
    videoCount: rows.length,
    surveyCount,
    quizCount,
    recent: rows.slice(0, recentLimit).map((v) => ({ ...toRecord(v), interactionCount: v.interactions.length })),
  };
}
