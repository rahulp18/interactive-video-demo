import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PUT as enableRoute, DELETE as disableRoute } from "@/app/api/videos/[id]/share/route";
import { POST as answerRoute } from "@/app/api/public/videos/[shareId]/interactions/[interactionId]/answer/route";
import { createSession } from "@/lib/auth/session";
import { createInteraction } from "@/lib/interactions/service";
import { enableSharing, getPublicVideo } from "@/lib/watch/service";
import { rateLimit } from "@/lib/api/rate-limit";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("uploadthing/server", () => ({ UTApi: class { deleteFiles = async () => ({}); } }));

const ORIGIN = "http://localhost:3000";
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) }) as never;

describe("public sharing and answers", () => {
  const emails: string[] = [];
  let owner = 0, tokenOwner = "", tokenOther = "", videoId = 0;
  let quizId = 0, surveyId = 0, correctId = 0, wrongId = 0, surveyOptionId = 0;

  async function makeUser(label: string) {
    const email = `${label}-${randomUUID()}@example.com`;
    emails.push(email);
    const u = await db.orm.public.User.create({ name: label, email, password: "x" });
    return { id: u.id, token: (await createSession(u.id)).token };
  }
  const authed = (method: string, path: string, token: string) =>
    new Request(ORIGIN + path, { method, headers: { authorization: `Bearer ${token}` } });
  const answer = (shareId: string, interactionId: number | string, body: unknown, headers: Record<string, string> = {}) =>
    answerRoute(
      new Request(`${ORIGIN}/x`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }),
      params({ shareId, interactionId: String(interactionId) }),
    );

  beforeAll(async () => {
    const a = await makeUser("share-owner");
    const b = await makeUser("share-other");
    [owner, tokenOwner, tokenOther] = [a.id, a.token, b.token];
    const key = `key-${randomUUID()}`;
    const v = await db.orm.public.Video.create({
      title: "Shared", fileUrl: `https://example.ufs.sh/f/${key}`, duration: 60, mimeType: "video/mp4",
      originalName: "s.mp4", sizeBytes: 1, fileKey: key, uploaderId: owner,
    });
    videoId = v.id;
    const quiz = await createInteraction(owner, videoId, {
      type: "QUIZ", timestamp: 10, question: "2+2?", isSkippable: false,
      options: [{ text: "3" }, { text: "4", isCorrect: true }],
    });
    const survey = await createInteraction(owner, videoId, {
      type: "SURVEY", timestamp: 5, question: "Like it?", isSkippable: true, options: [{ text: "Yes" }, { text: "No" }],
    });
    quizId = quiz.id; surveyId = survey.id;
    correctId = quiz.options.find((o) => o.isCorrect)!.id;
    wrongId = quiz.options.find((o) => !o.isCorrect)!.id;
    surveyOptionId = survey.options[0].id;
  });

  afterAll(async () => {
    for (const email of emails) {
      const u = await db.orm.public.User.where({ email }).first();
      if (u) {
        await db.orm.public.Video.where({ uploaderId: u.id }).deleteAll();
        await db.orm.public.User.where({ id: u.id }).deleteAll();
      }
    }
  });

  it("is private by default: nothing resolves before sharing", async () => {
    expect((await db.orm.public.Video.where({ id: videoId }).first())?.shareId).toBeNull();
    expect(await getPublicVideo("A".repeat(16))).toBeNull();
  });

  it("only the owner can enable or disable; the token is unguessable and stable", async () => {
    const p = params({ id: String(videoId) });
    expect((await enableRoute(authed("PUT", "/x", tokenOther), p)).status).toBe(404);
    expect((await disableRoute(authed("DELETE", "/x", tokenOther), p)).status).toBe(404);
    expect((await enableRoute(new Request(ORIGIN + "/x", { method: "PUT" }), p)).status).toBe(401);

    const res = await enableRoute(authed("PUT", "/x", tokenOwner), p);
    const { shareId } = await res.json();
    expect(shareId).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(await enableSharing(owner, videoId)).toBe(shareId);
    const [x, y] = await Promise.all([enableSharing(owner, videoId), enableSharing(owner, videoId)]);
    expect(x).toBe(shareId);
    expect(y).toBe(shareId);
  });

  it("the public view lists interactions in order and never exposes correct answers", async () => {
    const { shareId } = (await db.orm.public.Video.where({ id: videoId }).first())! as { shareId: string };
    const pub = (await getPublicVideo(shareId))!;
    expect(pub.title).toBe("Shared");
    expect(pub.interactions.map((i) => i.question)).toEqual(["Like it?", "2+2?"]);
    const json = JSON.stringify(pub);
    expect(json).not.toMatch(/isCorrect|correct|uploader|fileKey/i);
    expect(pub.interactions[1].options.map((o) => o.text)).toEqual(["3", "4"]);
  });

  it("rejects malformed or unknown tokens", async () => {
    for (const bad of ["", "short", "a".repeat(17), "!".repeat(16), "../../etc/passwd"]) expect(await getPublicVideo(bad)).toBeNull();
    expect(await getPublicVideo("Z".repeat(16))).toBeNull();
    expect((await answer("Z".repeat(16), quizId, { optionId: correctId })).status).toBe(404);
  });

  it("grades quiz answers server-side and validates survey answers", async () => {
    const { shareId } = (await db.orm.public.Video.where({ id: videoId }).first())! as { shareId: string };
    expect(await (await answer(shareId, quizId, { optionId: wrongId })).json()).toEqual({ type: "QUIZ", correct: false, correctOptionId: correctId, correctAnswer: null });
    expect(await (await answer(shareId, quizId, { optionId: correctId })).json()).toEqual({ type: "QUIZ", correct: true, correctOptionId: correctId, correctAnswer: null });
    expect(await (await answer(shareId, surveyId, { optionId: surveyOptionId })).json()).toEqual({ type: "SURVEY" });
    // option of another interaction, missing, wrong type, unknown interaction
    expect((await answer(shareId, quizId, { optionId: surveyOptionId })).status).toBe(400);
    expect((await answer(shareId, quizId, {})).status).toBe(400);
    expect((await answer(shareId, quizId, { optionId: "1" })).status).toBe(400);
    expect((await answer(shareId, 999999999, { optionId: 1 })).status).toBe(404);
    expect((await answer(shareId, quizId, { optionId: correctId }, { origin: "https://evil.example" })).status).toBe(403);
    // nothing is persisted for anonymous viewers
    expect(await db.orm.public.InteractionResponse.where({ interactionId: quizId }).all()).toHaveLength(0);
  });

  it("revoking stops access at once and re-enabling issues a new token", async () => {
    const p = params({ id: String(videoId) });
    const old = (await db.orm.public.Video.where({ id: videoId }).first())!.shareId as string;
    expect((await disableRoute(authed("DELETE", "/x", tokenOwner), p)).status).toBe(200);
    expect(await getPublicVideo(old)).toBeNull();
    expect((await answer(old, quizId, { optionId: correctId })).status).toBe(404);
    const { shareId } = await (await enableRoute(authed("PUT", "/x", tokenOwner), p)).json();
    expect(shareId).not.toBe(old);
    expect(await getPublicVideo(old)).toBeNull();
    expect(await getPublicVideo(shareId)).not.toBeNull();
  });

  it("rate limits bursts per client", () => {
    const req = new Request(ORIGIN, { headers: { "x-forwarded-for": "203.0.113.9" } });
    for (let i = 0; i < 3; i++) rateLimit(req, "t", 3, 60_000);
    expect(() => rateLimit(req, "t", 3, 60_000)).toThrow(/Too many/);
    expect(() => rateLimit(new Request(ORIGIN, { headers: { "x-forwarded-for": "203.0.113.10" } }), "t", 3, 60_000)).not.toThrow();
  });
});
