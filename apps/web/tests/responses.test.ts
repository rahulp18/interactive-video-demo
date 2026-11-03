import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as responsesRoute } from "@/app/api/videos/[id]/responses/route";
import { PUT as listingRoute } from "@/app/api/videos/[id]/listing/route";
import { POST as answerRoute } from "@/app/api/public/videos/[shareId]/interactions/[interactionId]/answer/route";
import { safeNextPath, withNext } from "@/lib/auth/redirect";
import { createSession } from "@/lib/auth/session";
import { createInteraction } from "@/lib/interactions/service";
import { getResponseOverview, getResponseSummary, responsesToCsv } from "@/lib/responses/service";
import { disableSharing, enableSharing, getViewerAnsweredIds, listLibrary, setListed } from "@/lib/watch/service";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("uploadthing/server", () => ({ UTApi: class { deleteFiles = async () => ({}); } }));

const ORIGIN = "http://localhost:3000";
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) }) as never;

describe("redirect safety", () => {
  it("only allows same-site absolute paths", () => {
    expect(safeNextPath("/watch/abc")).toBe("/watch/abc");
    for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "evil", "", null, undefined, "/a\nb"]) {
      expect(safeNextPath(bad as string)).toBe("/dashboard");
    }
    expect(withNext("/login", "/watch/x y")).toBe("/login?next=%2Fwatch%2Fx%20y");
    expect(withNext("/login", "//evil.com")).toBe("/login");
  });
});

describe("responses, results and library", () => {
  const emails: string[] = [];
  const users: Record<string, { id: number; token: string; name: string }> = {};
  let videoId = 0, shareId = "", quizId = 0, surveyId = 0, optA = 0, optB = 0, sOpt1 = 0, sOpt2 = 0;

  async function makeUser(key: string, name: string) {
    const email = `${key}-${randomUUID()}@example.com`;
    emails.push(email);
    const u = await db.orm.public.User.create({ name, email, password: "secret-hash" });
    users[key] = { id: u.id, token: (await createSession(u.id)).token, name };
  }
  const authed = (method: string, path: string, key: string, body?: unknown) =>
    new Request(ORIGIN + path, {
      method,
      headers: { authorization: `Bearer ${users[key].token}`, ...(body !== undefined && { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const answer = (interactionId: number, body: unknown, as?: string) =>
    answerRoute(
      new Request(`${ORIGIN}/x`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(as && { authorization: `Bearer ${users[as].token}` }) },
        body: JSON.stringify(body),
      }),
      params({ shareId, interactionId: String(interactionId) }),
    );

  beforeAll(async () => {
    await makeUser("owner", "Olivia Owner");
    await makeUser("ann", '=HYPERLINK("x")');
    await makeUser("bob", "Bob Viewer");
    await makeUser("zed", "Zed Stranger");
    const key = `key-${randomUUID()}`;
    const v = await db.orm.public.Video.create({
      title: "Results Demo", fileUrl: `https://example.ufs.sh/f/${key}`, duration: 60, mimeType: "video/mp4",
      originalName: "r.mp4", sizeBytes: 1, fileKey: key, uploaderId: users.owner.id,
    });
    videoId = v.id;
    const quiz = await createInteraction(users.owner.id, videoId, { type: "QUIZ", timestamp: 10, question: "Capital of France?", isSkippable: false, options: [{ text: "Paris", isCorrect: true }, { text: "Rome" }] });
    const survey = await createInteraction(users.owner.id, videoId, { type: "SURVEY", timestamp: 5, question: "Rate this", isSkippable: true, options: [{ text: "Good" }, { text: "Bad" }] });
    quizId = quiz.id; surveyId = survey.id;
    optA = quiz.options[0].id; optB = quiz.options[1].id;
    sOpt1 = survey.options[0].id; sOpt2 = survey.options[1].id;
    shareId = await enableSharing(users.owner.id, videoId);
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

  it("stores signed-in answers (first one stands), never anonymous ones", async () => {
    expect((await (await answer(quizId, { optionId: optA }, "ann")).json()).correct).toBe(true);
    // replay with a different choice is graded but must not rewrite the stored answer
    expect((await (await answer(quizId, { optionId: optB }, "ann")).json()).correct).toBe(false);
    await answer(surveyId, { optionId: sOpt1 }, "ann");
    await answer(quizId, { optionId: optB }, "bob");
    expect((await (await answer(surveyId, { skip: true }, "bob")).json()).type).toBe("SKIPPED");
    await answer(quizId, { optionId: optA }); // anonymous
    await answer(surveyId, { optionId: sOpt2 }); // anonymous

    const stored = await db.orm.public.InteractionResponse.where({ userId: users.ann.id }).where({ interactionId: quizId }).all();
    expect(stored).toHaveLength(1);
    expect(stored[0].selectedOptionId).toBe(optA);
    const all = await db.orm.public.InteractionResponse.where((r) => r.interactionId.in([quizId, surveyId])).all();
    expect(all).toHaveLength(4); // ann x2, bob x2 - no anonymous rows
    expect((await getViewerAnsweredIds(users.ann.id, shareId)).sort()).toEqual([quizId, surveyId].sort());
    expect(await getViewerAnsweredIds(users.zed.id, shareId)).toEqual([]);
  });

  it("a required question cannot be skipped", async () => {
    expect((await answer(quizId, { skip: true }, "zed")).status).toBe(400);
    expect(await db.orm.public.InteractionResponse.where({ userId: users.zed.id }).all()).toHaveLength(0);
  });

  it("summarises per question and per identified person", async () => {
    const s = await getResponseSummary(users.owner.id, videoId);
    expect(s.respondentCount).toBe(2);
    expect(s.totalResponses).toBe(4);
    const [survey, quiz] = s.interactions; // timestamp order
    expect(survey.question).toBe("Rate this");
    expect(survey.answered).toBe(1);
    expect(survey.skipped).toBe(1);
    expect(survey.options.map((o) => o.count)).toEqual([1, 0]);
    expect(quiz.answered).toBe(2);
    expect(quiz.correctRate).toBe(0.5);
    expect(quiz.options.find((o) => o.isCorrect)?.count).toBe(1);

    const ann = s.respondents.find((p) => p.userId === users.ann.id)!;
    expect(ann).toMatchObject({ answered: 2, skipped: 0, correct: 1 });
    expect(ann.answers[quizId]).toMatchObject({ optionId: optA, correct: true });
    const bob = s.respondents.find((p) => p.userId === users.bob.id)!;
    expect(bob).toMatchObject({ answered: 1, skipped: 1, correct: 0 });
    expect(bob.answers[surveyId]).toMatchObject({ skipped: true, optionId: null });
    expect(JSON.stringify(s)).not.toMatch(/password|secret-hash|token/i);

    const overview = (await getResponseOverview(users.owner.id)).find((v) => v.id === videoId)!;
    expect(overview).toMatchObject({ respondentCount: 2, responseCount: 4, isShared: true, interactionCount: 2 });
  });

  it("results are owner-only (API and service)", async () => {
    const p = params({ id: String(videoId) });
    expect((await responsesRoute(authed("GET", "/x", "bob"), p)).status).toBe(404);
    expect((await responsesRoute(new Request(ORIGIN + "/x"), p)).status).toBe(401);
    await expect(getResponseSummary(users.bob.id, videoId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getResponseOverview(users.bob.id)).find((v) => v.id === videoId)).toBeUndefined();
    const ok = await responsesRoute(authed("GET", "/x", "owner"), p);
    expect(ok.status).toBe(200);
    expect((await ok.json()).respondentCount).toBe(2);
  });

  it("exports CSV with escaping and spreadsheet-formula protection", async () => {
    const res = await responsesRoute(authed("GET", "/x?format=csv", "owner"), params({ id: String(videoId) }));
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const csv = await res.text();
    expect(csv.split("\r\n")[0]).toBe("Name,Email,Timestamp (s),Type,Question,Answer,Skipped,Correct,Answered at");
    expect(csv).toContain("Paris");
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toMatch(/,=HYPERLINK/);
    expect(responsesToCsv(await getResponseSummary(users.owner.id, videoId)).trim().split("\r\n")).toHaveLength(5); // header + 4 rows
  });

  it("Library lists only listed, shared videos; unsharing removes them", async () => {
    expect((await listLibrary()).some((v) => v.shareId === shareId)).toBe(false);
    const p = params({ id: String(videoId) });
    expect((await listingRoute(authed("PUT", "/x", "bob", { listed: true }), p)).status).toBe(404);
    expect((await listingRoute(authed("PUT", "/x", "owner", { listed: "yes" }), p)).status).toBe(400);
    expect((await listingRoute(authed("PUT", "/x", "owner", { listed: true }), p)).status).toBe(200);
    const item = (await listLibrary()).find((v) => v.shareId === shareId)!;
    expect(item).toMatchObject({ title: "Results Demo", author: "Olivia Owner", interactionCount: 2 });
    expect(JSON.stringify(item)).not.toMatch(/email|fileKey|isCorrect/);
    await disableSharing(users.owner.id, videoId);
    expect((await listLibrary()).some((v) => v.title === "Results Demo")).toBe(false);
    expect((await db.orm.public.Video.where({ id: videoId }).first())?.isListed).toBe(false);
    // listing a private video creates the link on the way
    const r = await setListed(users.owner.id, videoId, true);
    expect(r.shareId).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(r.isListed).toBe(true);
  });
});
