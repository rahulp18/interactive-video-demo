import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { isAllowedVideoType, titleFromFilename, videoUploadInput } from "@/lib/videos/policy";
import { saveUploadedVideo } from "@/lib/videos/service";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));

const validate = (v: unknown) => videoUploadInput["~standard"].validate(v);

describe("video policy", () => {
  it("allows only supported video mime types", () => {
    expect(isAllowedVideoType("video/mp4")).toBe(true);
    expect(isAllowedVideoType("VIDEO/WEBM")).toBe(true);
    expect(isAllowedVideoType("image/png")).toBe(false);
    expect(isAllowedVideoType("text/plain")).toBe(false);
    expect(isAllowedVideoType("video/x-msvideo")).toBe(false);
  });

  it("derives a title from the filename", () => {
    expect(titleFromFilename("My Clip.final.mp4")).toBe("My Clip.final");
    expect(titleFromFilename(".mp4")).toBe(".mp4");
    expect(titleFromFilename("noext")).toBe("noext");
    expect(titleFromFilename("a".repeat(500) + ".mp4")).toHaveLength(200);
  });

  it("validates reported duration", () => {
    expect(validate({ duration: 12.5 })).toEqual({ value: { duration: 12.5 } });
    for (const bad of [undefined, null, {}, { duration: -1 }, { duration: NaN }, { duration: Infinity }, { duration: "3" }, { duration: 999999 }]) {
      expect(validate(bad)).toHaveProperty("issues");
    }
  });
});

describe("saveUploadedVideo", () => {
  const emails: string[] = [];
  afterAll(async () => {
    for (const email of emails) {
      const user = await db.orm.public.User.where({ email }).first();
      if (user) {
        await db.orm.public.Video.where({ uploaderId: user.id }).deleteAll();
        await db.orm.public.User.where({ id: user.id }).deleteAll();
      }
    }
  });

  it("persists once per file key and links the uploader", async () => {
    const email = `videotest-${randomUUID()}@example.com`;
    emails.push(email);
    const user = await db.orm.public.User.create({ name: "V", email, password: "x" });
    const file = { key: `key-${randomUUID()}`, name: "Clip.mp4", size: 1234, type: "video/mp4", ufsUrl: "https://example.ufs.sh/f/abc" };

    const [a, b] = await Promise.all([saveUploadedVideo(user.id, 3, file), saveUploadedVideo(user.id, 3, file)]);
    const again = await saveUploadedVideo(user.id, 3, file);

    expect(a.id).toBe(b.id);
    expect(again.id).toBe(a.id);
    const rows = await db.orm.public.Video.where({ fileKey: file.key }).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ uploaderId: user.id, title: "Clip", fileUrl: file.ufsUrl, mimeType: "video/mp4", originalName: "Clip.mp4", sizeBytes: 1234, duration: 3 });
  });
});
