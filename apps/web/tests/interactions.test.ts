import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as listInteractions } from "@/app/api/interactions/route";
import { GET as listVideosRoute } from "@/app/api/videos/route";
import { DELETE as deleteVideoRoute, GET as getVideoRoute, PATCH as patchVideoRoute } from "@/app/api/videos/[id]/route";
import { POST as createInteractionRoute } from "@/app/api/videos/[id]/interactions/route";
import { DELETE as deleteInteractionRoute, PUT as putInteractionRoute } from "@/app/api/videos/[id]/interactions/[interactionId]/route";
import { createSession } from "@/lib/auth/session";
import { formatPreciseTimestamp, parseTimestamp, validateInteraction } from "@/lib/interactions/model";
import { getDashboardStats } from "@/lib/videos/service";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
// `connection()` only works inside a Next.js request scope; route handlers are invoked directly here.
vi.mock("next/server", () => ({ connection: async () => {} }));
const deleteFiles = vi.hoisted(() => vi.fn(async () => ({ success: true, deletedCount: 1 })));
vi.mock("uploadthing/server", () => ({
  UTApi: class {
    deleteFiles = deleteFiles;
  },
  UploadThingError: class extends Error {},
}));

const ORIGIN = "http://localhost:3000";
const DURATION = 120;

describe("interaction validation (pure)", () => {
  const base = {
    type: "QUIZ",
    timestamp: 10,
    question: " Q? ",
    isSkippable: false,
    options: [{ text: "a", isCorrect: true }, { text: "b" }],
  };

  it("accepts a valid quiz and trims text", () => {
    const r = validateInteraction(base, DURATION);
    expect(r.errors).toBeUndefined();
    expect(r.value).toMatchObject({ type: "QUIZ", timestamp: 10, question: "Q?" });
  });

  it("rejects timestamps outside 0..duration, NaN and non-numbers", () => {
    for (const timestamp of [-0.1, DURATION + 0.1, NaN, Infinity, "5", null]) {
      expect(validateInteraction({ ...base, timestamp }, DURATION).errors).toHaveProperty("timestamp");
    }
    expect(validateInteraction({ ...base, timestamp: 0 }, DURATION).errors).toBeUndefined();
    expect(validateInteraction({ ...base, timestamp: DURATION }, DURATION).errors).toBeUndefined();
  });

  it("requires exactly one correct option for quizzes and clears the flag for surveys", () => {
    expect(validateInteraction({ ...base, options: [{ text: "a" }, { text: "b" }] }, DURATION).errors).toHaveProperty("options");
    const both = [{ text: "a", isCorrect: true }, { text: "b", isCorrect: true }];
    expect(validateInteraction({ ...base, options: both }, DURATION).errors).toHaveProperty("options");
    const survey = validateInteraction({ ...base, type: "SURVEY", options: both }, DURATION);
    expect(survey.value?.options.every((o) => o.isCorrect === false)).toBe(true);
  });

  it("enforces option count, question and option text", () => {
    expect(validateInteraction({ ...base, options: [{ text: "a", isCorrect: true }] }, DURATION).errors).toHaveProperty("options");
    expect(validateInteraction({ ...base, question: "  " }, DURATION).errors).toHaveProperty("question");
    expect(validateInteraction({ ...base, options: [{ text: "", isCorrect: true }, { text: "b" }] }, DURATION).errors).toHaveProperty("options.0");
    expect(validateInteraction({ ...base, type: "POLL" }, DURATION).errors).toHaveProperty("type");
    expect(validateInteraction(null, DURATION).errors).toHaveProperty("_");
  });
});

describe("timestamp parsing", () => {
  it("parses clock and second formats", () => {
    expect(parseTimestamp("75")).toBe(75);
    expect(parseTimestamp("1:05.5")).toBe(65.5);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(parseTimestamp(" 0:09 ")).toBe(9);
  });
  it("rejects garbage", () => {
    for (const bad of ["", "abc", "1:2:3:4", "-5", "1:-2", "1.5:30", "1e3", "NaN"]) expect(parseTimestamp(bad)).toBeNull();
  });
  it("formats with one decimal", () => {
    expect(formatPreciseTimestamp(65.5)).toBe("1:05.5");
    expect(formatPreciseTimestamp(0)).toBe("0:00.0");
    expect(formatPreciseTimestamp(3723)).toBe("1:02:03.0");
  });
});

describe("videos & interactions API", () => {
  const emails: string[] = [];
  let tokenA = "";
  let tokenB = "";
  let userA = 0;
  let userB = 0;
  let videoA = 0;
  let videoB = 0;

  async function makeUser(label: string) {
    const email = `${label}-${randomUUID()}@example.com`;
    emails.push(email);
    const user = await db.orm.public.User.create({ name: label, email, password: "x" });
    return { id: user.id, token: (await createSession(user.id)).token };
  }
  async function makeVideo(uploaderId: number, title: string) {
    const key = `key-${randomUUID()}`;
    const v = await db.orm.public.Video.create({
      title, fileUrl: `https://example.ufs.sh/f/${key}`, duration: DURATION, mimeType: "video/mp4",
      originalName: `${title}.mp4`, sizeBytes: 10, fileKey: key, uploaderId,
    });
    return v.id;
  }
  const req = (method: string, path: string, token: string | null, body?: unknown) =>
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: { ...(token && { authorization: `Bearer ${token}` }), ...(body !== undefined && { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) }) as never;
  const quiz = (over: object = {}) => ({
    type: "QUIZ", timestamp: 30, question: "What colour?", isSkippable: false,
    options: [{ text: "Red", isCorrect: true }, { text: "Blue", isCorrect: false }], ...over,
  });
  const create = async (token: string | null, videoId: number, body: unknown) =>
    createInteractionRoute(req("POST", `/api/videos/${videoId}/interactions`, token, body), params({ id: String(videoId) }));

  beforeAll(async () => {
    const a = await makeUser("owner");
    const b = await makeUser("other");
    [tokenA, userA, tokenB, userB] = [a.token, a.id, b.token, b.id];
    videoA = await makeVideo(userA, "A video");
    videoB = await makeVideo(userB, "B video");
  });

  afterAll(async () => {
    for (const email of emails) {
      const user = await db.orm.public.User.where({ email }).first();
      if (user) {
        await db.orm.public.Video.where({ uploaderId: user.id }).deleteAll();
        await db.orm.public.User.where({ id: user.id }).deleteAll();
      }
    }
  });

  it("requires authentication on every endpoint", async () => {
    expect((await listVideosRoute(req("GET", "/api/videos", null))).status).toBe(401);
    expect((await getVideoRoute(req("GET", `/api/videos/${videoA}`, null), params({ id: String(videoA) }))).status).toBe(401);
    expect((await create(null, videoA, quiz())).status).toBe(401);
    expect((await listInteractions(req("GET", "/api/interactions", null))).status).toBe(401);
  });

  it("rejects cross-origin state changes", async () => {
    const r = new Request(`${ORIGIN}/api/videos/${videoA}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${tokenA}`, origin: "https://evil.example" },
    });
    expect((await deleteVideoRoute(r, params({ id: String(videoA) }))).status).toBe(403);
  });

  it("creates interactions, sorts them by timestamp and returns options in order", async () => {
    const late = await create(tokenA, videoA, quiz({ timestamp: 90, question: "Late" }));
    const early = await create(tokenA, videoA, { type: "SURVEY", timestamp: 5.04, question: "Early", isSkippable: true, options: [{ text: "x" }, { text: "y" }] });
    const tied = await create(tokenA, videoA, quiz({ timestamp: 90, question: "Tied" }));
    expect([late.status, early.status, tied.status]).toEqual([201, 201, 201]);

    const detail = await (await getVideoRoute(req("GET", `/api/videos/${videoA}`, tokenA), params({ id: String(videoA) }))).json();
    expect(detail.video.id).toBe(videoA);
    expect(detail.interactions.map((i: { question: string }) => i.question)).toEqual(["Early", "Late", "Tied"]);
    expect(detail.interactions[0]).toMatchObject({ timestamp: 5, type: "SURVEY", isSkippable: true });
    expect(detail.interactions[0].options.map((o: { text: string }) => o.text)).toEqual(["x", "y"]);
    expect(detail.interactions[1].options[0]).toMatchObject({ text: "Red", isCorrect: true, position: 0 });
  });

  it("rejects invalid timestamps and payloads with field errors", async () => {
    for (const body of [quiz({ timestamp: DURATION + 1 }), quiz({ timestamp: -1 }), quiz({ options: [{ text: "only" }] }), quiz({ question: "" })]) {
      const res = await create(tokenA, videoA, body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    }
    const notJson = await createInteractionRoute(
      new Request(`${ORIGIN}/api/videos/${videoA}/interactions`, { method: "POST", headers: { authorization: `Bearer ${tokenA}`, "content-type": "text/plain" }, body: "x" }),
      params({ id: String(videoA) }),
    );
    expect(notJson.status).toBe(415);
  });

  it("updates in place: option ids survive, removed options go, new ones are added, order follows the payload", async () => {
    const created = (await (await create(tokenA, videoA, quiz({ question: "Edit me", timestamp: 40, options: [{ text: "1", isCorrect: true }, { text: "2" }, { text: "3" }] }))).json()).interaction;
    const [o1, o2, o3] = created.options;
    const res = await putInteractionRoute(
      req("PUT", `/api/videos/${videoA}/interactions/${created.id}`, tokenA, {
        type: "QUIZ", timestamp: 10, question: "Edited", isSkippable: true,
        options: [{ id: o3.id, text: "3!" }, { text: "new", isCorrect: true }, { id: o1.id, text: "1" }],
      }),
      params({ id: String(videoA), interactionId: String(created.id) }),
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()).interaction;
    expect(updated).toMatchObject({ id: created.id, question: "Edited", timestamp: 10, isSkippable: true });
    expect(updated.options.map((o: { text: string; isCorrect: boolean }) => [o.text, o.isCorrect])).toEqual([["3!", false], ["new", true], ["1", false]]);
    expect(updated.options[0].id).toBe(o3.id);
    expect(updated.options[2].id).toBe(o1.id);
    expect(updated.options.some((o: { id: number }) => o.id === o2.id)).toBe(false);
  });

  it("refuses to remove an option that already has responses", async () => {
    const created = (await (await create(tokenA, videoA, quiz({ question: "Answered", timestamp: 50 }))).json()).interaction;
    await db.orm.public.InteractionResponse.create({ userId: userA, interactionId: created.id, selectedOptionId: created.options[1].id, isSkipped: false });
    const res = await putInteractionRoute(
      req("PUT", `/api/videos/${videoA}/interactions/${created.id}`, tokenA, quiz({ question: "Answered", timestamp: 50, options: [{ id: created.options[0].id, text: "Red", isCorrect: true }, { text: "Green" }] })),
      params({ id: String(videoA), interactionId: String(created.id) }),
    );
    expect(res.status).toBe(409);
    // Nothing was partially applied.
    const still = await db.orm.public.InteractionOption.where({ interactionId: created.id }).all();
    expect(still.map((o) => o.text).sort()).toEqual(["Blue", "Red"]);
  });

  it("rejects options that belong to another interaction", async () => {
    const a = (await (await create(tokenA, videoA, quiz({ question: "A", timestamp: 60 }))).json()).interaction;
    const b = (await (await create(tokenA, videoA, quiz({ question: "B", timestamp: 61 }))).json()).interaction;
    const res = await putInteractionRoute(
      req("PUT", `/api/videos/${videoA}/interactions/${a.id}`, tokenA, quiz({ options: [{ id: b.options[0].id, text: "hijack", isCorrect: true }, { text: "z" }] })),
      params({ id: String(videoA), interactionId: String(a.id) }),
    );
    expect(res.status).toBe(400);
    expect((await db.orm.public.InteractionOption.where({ id: b.options[0].id }).first())?.text).toBe("Red");
  });

  it("isolates users: another account gets 404 for every read and write", async () => {
    const mine = (await (await create(tokenA, videoA, quiz({ question: "Private", timestamp: 70 }))).json()).interaction;
    const p = params({ id: String(videoA) });
    expect((await getVideoRoute(req("GET", `/api/videos/${videoA}`, tokenB), p)).status).toBe(404);
    expect((await patchVideoRoute(req("PATCH", `/api/videos/${videoA}`, tokenB, { title: "pwned" }), p)).status).toBe(404);
    expect((await create(tokenB, videoA, quiz())).status).toBe(404);
    const pi = params({ id: String(videoA), interactionId: String(mine.id) });
    expect((await putInteractionRoute(req("PUT", "/x", tokenB, quiz()), pi)).status).toBe(404);
    expect((await deleteInteractionRoute(req("DELETE", "/x", tokenB), pi)).status).toBe(404);
    // Using own video id with the other user's interaction id must not reach it either.
    const cross = params({ id: String(videoB), interactionId: String(mine.id) });
    expect((await deleteInteractionRoute(req("DELETE", "/x", tokenB), cross)).status).toBe(404);
    expect((await deleteVideoRoute(req("DELETE", `/api/videos/${videoA}`, tokenB), p)).status).toBe(404);

    expect((await db.orm.public.Interaction.where({ id: mine.id }).first())?.question).toBe("Private");
    expect((await db.orm.public.Video.where({ id: videoA }).first())?.title).toBe("A video");

    const listB = await (await listVideosRoute(req("GET", "/api/videos", tokenB))).json();
    expect(listB.videos.map((v: { id: number }) => v.id)).toEqual([videoB]);
    const groupsB = await (await listInteractions(req("GET", "/api/interactions", tokenB))).json();
    expect(groupsB.groups).toEqual([]);
    const stolen = await (await listInteractions(req("GET", `/api/interactions?videoId=${videoA}`, tokenB))).json();
    expect(stolen.groups).toEqual([]);
    expect(deleteFiles).not.toHaveBeenCalled();
  });

  it("treats malformed ids as not found", async () => {
    for (const id of ["abc", "0", "-1", "1.5", "99999999999", "1e3"]) {
      expect((await getVideoRoute(req("GET", `/api/videos/${id}`, tokenA), params({ id }))).status).toBe(404);
    }
  });

  it("groups by video and filters by type, search text and video", async () => {
    const all = await (await listInteractions(req("GET", "/api/interactions", tokenA))).json();
    expect(all.groups).toHaveLength(1);
    expect(all.groups[0].video).toMatchObject({ id: videoA, title: "A video" });
    const stamps = all.groups[0].interactions.map((i: { timestamp: number }) => i.timestamp);
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b));

    const surveys = await (await listInteractions(req("GET", "/api/interactions?type=SURVEY", tokenA))).json();
    expect(surveys.groups[0].interactions.map((i: { question: string }) => i.question)).toEqual(["Early"]);
    const quizzes = await (await listInteractions(req("GET", "/api/interactions?type=QUIZ", tokenA))).json();
    expect(quizzes.groups[0].interactions.every((i: { type: string }) => i.type === "QUIZ")).toBe(true);

    const search = await (await listInteractions(req("GET", "/api/interactions?q=LATE", tokenA))).json();
    expect(search.groups[0].interactions.map((i: { question: string }) => i.question)).toEqual(["Late"]);
    const none = await (await listInteractions(req("GET", "/api/interactions?q=zzzz", tokenA))).json();
    expect(none.groups).toEqual([]);
    const pct = await (await listInteractions(req("GET", "/api/interactions?q=%25", tokenA))).json();
    expect(pct.groups).toEqual([]);
    expect((await listInteractions(req("GET", "/api/interactions?type=POLL", tokenA))).status).toBe(400);
  });

  it("lists videos with interaction counts and reports real dashboard stats", async () => {
    const list = await (await listVideosRoute(req("GET", "/api/videos", tokenA))).json();
    expect(list.videos).toHaveLength(1);
    const count = await db.orm.public.Interaction.where({ videoId: videoA }).all();
    expect(list.videos[0].interactionCount).toBe(count.length);
    const stats = await getDashboardStats(userA);
    expect(stats.videoCount).toBe(1);
    expect(stats.surveyCount).toBe(count.filter((i) => i.type === "SURVEY").length);
    expect(stats.quizCount).toBe(count.filter((i) => i.type === "QUIZ").length);
    expect(stats.recent[0].id).toBe(videoA);
  });

  it("renames a video and validates the title", async () => {
    const p = params({ id: String(videoA) });
    const ok = await patchVideoRoute(req("PATCH", `/api/videos/${videoA}`, tokenA, { title: "  Renamed   video " }), p);
    expect((await ok.json()).video.title).toBe("Renamed video");
    expect((await patchVideoRoute(req("PATCH", `/api/videos/${videoA}`, tokenA, { title: "  " }), p)).status).toBe(400);
    expect((await patchVideoRoute(req("PATCH", `/api/videos/${videoA}`, tokenA, { title: "x".repeat(201) }), p)).status).toBe(400);
  });

  it("deletes an interaction, then a video with everything under it", async () => {
    const created = (await (await create(tokenA, videoA, quiz({ question: "Gone", timestamp: 80 }))).json()).interaction;
    const pi = params({ id: String(videoA), interactionId: String(created.id) });
    expect((await deleteInteractionRoute(req("DELETE", "/x", tokenA), pi)).status).toBe(200);
    expect((await deleteInteractionRoute(req("DELETE", "/x", tokenA), pi)).status).toBe(404);
    expect(await db.orm.public.InteractionOption.where({ interactionId: created.id }).all()).toHaveLength(0);

    const key = (await db.orm.public.Video.where({ id: videoA }).first())!.fileKey;
    expect((await deleteVideoRoute(req("DELETE", `/api/videos/${videoA}`, tokenA), params({ id: String(videoA) }))).status).toBe(200);
    expect(await db.orm.public.Video.where({ id: videoA }).first()).toBeNull();
    expect(await db.orm.public.Interaction.where({ videoId: videoA }).all()).toHaveLength(0);
    expect(deleteFiles).toHaveBeenCalledWith(key);
  });
});
