import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as answersRoute } from "@/app/api/student/modules/[moduleId]/answers/route";
import { PUT as progressRoute } from "@/app/api/student/modules/[moduleId]/progress/route";
import { POST as completeRoute } from "@/app/api/student/modules/[moduleId]/complete/route";
import { createSession } from "@/lib/auth/session";
import { createInteraction } from "@/lib/interactions/service";
import { loadPlayerModule } from "@/lib/learning/service";
import { getAssessment, getChildView } from "@/lib/scoring/service";
import { checkPublicAnswer, enableSharing } from "@/lib/watch/service";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("uploadthing/server", () => ({ UTApi: class { deleteFiles = async () => ({}); } }));

const ORIGIN = "http://localhost:3000";
const params = (moduleId: number | string) => ({ params: Promise.resolve({ moduleId: String(moduleId) }) }) as never;
// Nothing a student receives may mention how options are scored or which one is "right".
const FORBIDDEN = /isCorrect|correctOptionId|correctAnswer|weight|score|percent/i;

describe("student learning API", () => {
  const emails: string[] = [];
  const journeyIds: number[] = [];
  let teacher = { id: 0, token: "" };
  let student = { id: 0, token: "" };
  let virtueId = 0;
  // Module A (open) has: required SURVEY q1, required QUIZ q2, skippable SURVEY q3. Module B is level 2 (locked until A is done).
  // Module C is another open module; module D is a draft; module E is a shared video used for the /watch path.
  const ids = { a: 0, b: 0, c: 0, d: 0, videoA: 0, videoE: 0, q1: 0, q2: 0, q3: 0, qB: 0, qC: 0, q1a: 0, q1b: 0, q2right: 0, q2wrong: 0, qE: 0, qEopt: [0, 0] };

  async function makeUser(label: string, role: "STUDENT" | "TEACHER") {
    const email = `${label}-${randomUUID()}@example.com`;
    emails.push(email);
    const u = await db.orm.public.User.create({ name: label, email, password: "x", role });
    return { id: u.id, token: (await createSession(u.id)).token };
  }

  async function makeModule(title: string, status: "PUBLISHED" | "DRAFT" = "PUBLISHED") {
    const key = `key-${randomUUID()}`;
    const video = await db.orm.public.Video.create({
      title, fileUrl: `https://example.ufs.sh/f/${key}`, duration: 100, mimeType: "video/mp4", originalName: "v.mp4", sizeBytes: 1, fileKey: key, uploaderId: teacher.id,
    });
    const mod = await db.orm.public.Module.create({
      videoId: video.id, sourceStory: "Story (Test)", primaryVirtueId: virtueId, ageBand: "8-9", learningObjective: "Learn.", discussionPrompts: [], followUpActivity: `Try ${title} at home.`, status,
    });
    return { video, mod };
  }

  const call = (route: typeof answersRoute, method: string, token: string | null, moduleId: number | string, body?: unknown) =>
    route(
      new Request(`${ORIGIN}/x`, {
        method,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      params(moduleId),
    );
  const answer = (moduleId: number, body: Record<string, unknown>, token = student.token) =>
    call(answersRoute, "POST", token, moduleId, { responseTimeMs: 4200, replayCount: 1, positionSeconds: 20, idempotencyKey: `key-${randomUUID()}`, ...body });
  const responseOf = (interactionId: number) => db.orm.public.InteractionResponse.where({ userId: student.id, interactionId }).first();

  beforeAll(async () => {
    virtueId = (await db.orm.public.Virtue.first())!.id;
    teacher = await makeUser("learn-teacher", "TEACHER");
    student = await makeUser("learn-student", "STUDENT");

    const A = await makeModule("Module A");
    const B = await makeModule("Module B");
    const C = await makeModule("Module C");
    const D = await makeModule("Module D", "DRAFT");
    Object.assign(ids, { a: A.mod.id, b: B.mod.id, c: C.mod.id, d: D.mod.id, videoA: A.video.id });

    const q1 = await createInteraction(teacher.id, A.video.id, { type: "SURVEY", timestamp: 10, question: "What would you do?", isSkippable: false, options: [{ text: "Help" }, { text: "Walk away" }] });
    const q2 = await createInteraction(teacher.id, A.video.id, { type: "QUIZ", timestamp: 40, question: "What happens next?", isSkippable: false, options: [{ text: "Right", isCorrect: true }, { text: "Wrong" }] });
    const q3 = await createInteraction(teacher.id, A.video.id, { type: "SURVEY", timestamp: 70, question: "Like it?", isSkippable: true, options: [{ text: "Yes" }, { text: "No" }] });
    const qB = await createInteraction(teacher.id, B.video.id, { type: "SURVEY", timestamp: 10, question: "B?", isSkippable: false, options: [{ text: "x" }, { text: "y" }] });
    const qC = await createInteraction(teacher.id, C.video.id, { type: "SURVEY", timestamp: 10, question: "C?", isSkippable: false, options: [{ text: "x" }, { text: "y" }] });
    Object.assign(ids, { q1: q1.id, q2: q2.id, q3: q3.id, qB: qB.id, qC: qC.id, q1a: q1.options[0].id, q1b: q1.options[1].id });
    ids.q2right = q2.options.find((o) => o.isCorrect)!.id;
    ids.q2wrong = q2.options.find((o) => !o.isCorrect)!.id;
    // Scoring weights (a good and a poor option), so completing earns a star.
    await db.orm.public.OptionVirtueWeight.createAll([
      { optionId: ids.q1a, virtueId, weight: 2 },
      { optionId: ids.q1b, virtueId, weight: -1 },
    ]);

    // Journey: level 1 = A, C; level 2 = B.
    const journey = await db.orm.public.Journey.create({ title: "Test path", description: "t", displayOrder: 999 });
    journeyIds.push(journey.id);
    await db.orm.public.JourneyModule.createAll([
      { journeyId: journey.id, moduleId: A.mod.id, level: 1, position: 0 },
      { journeyId: journey.id, moduleId: C.mod.id, level: 1, position: 1 },
      { journeyId: journey.id, moduleId: B.mod.id, level: 2, position: 0 },
    ]);

    // A shared plain video for the public /watch path.
    const E = await makeModule("Shared E");
    ids.videoE = E.video.id;
    const qE = await createInteraction(teacher.id, E.video.id, { type: "SURVEY", timestamp: 5, question: "Like it?", isSkippable: true, options: [{ text: "Yes" }, { text: "No" }] });
    ids.qE = qE.id;
    ids.qEopt = qE.options.map((o) => o.id);
  }, 120_000);

  afterAll(async () => {
    for (const id of journeyIds) await db.orm.public.Journey.where({ id }).deleteAll();
    for (const email of emails) {
      const u = await db.orm.public.User.where({ email }).first();
      if (u) {
        await db.orm.public.Video.where({ uploaderId: u.id }).deleteAll();
        await db.orm.public.User.where({ id: u.id }).deleteAll();
      }
    }
  }, 60_000);

  // ------------------------------------------------------------------ access

  it("rejects anonymous callers (401) and teachers (403)", async () => {
    expect((await call(answersRoute, "POST", null, ids.a, {})).status).toBe(401);
    expect((await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1a }, teacher.token)).status).toBe(403);
    expect((await call(progressRoute as never, "PUT", teacher.token, ids.a, { positionSeconds: 5 })).status).toBe(403);
    expect((await call(completeRoute as never, "POST", teacher.token, ids.a)).status).toBe(403);
  });

  it("a locked module cannot be played, answered, progressed or completed", async () => {
    expect((await answer(ids.b, { interactionId: ids.qB, optionId: 0 })).status).toBe(403);
    expect((await call(progressRoute as never, "PUT", student.token, ids.b, { positionSeconds: 5 })).status).toBe(403);
    expect((await call(completeRoute as never, "POST", student.token, ids.b)).status).toBe(403);
    expect((await loadPlayerModule(student.id, ids.b)).status).toBe("locked");
    expect(await responseOf(ids.qB)).toBeNull();
  });

  it("an unpublished or missing module is not found", async () => {
    expect((await answer(ids.d, { interactionId: 1, optionId: 1 })).status).toBe(404);
    expect((await loadPlayerModule(student.id, ids.d)).status).toBe("missing");
    expect((await loadPlayerModule(student.id, 2_000_000_000)).status).toBe("missing");
    expect((await answer(ids.a + 100_000_000, { interactionId: ids.q1, optionId: ids.q1a })).status).toBe(404);
  });

  it("an interaction from another module is rejected", async () => {
    const res = await answer(ids.a, { interactionId: ids.qC, optionId: 1 });
    expect(res.status).toBe(404);
    expect(await responseOf(ids.qC)).toBeNull();
  });

  // ------------------------------------------------------------------ player data

  it("player data has options and resume info but never correctness, weights or scores", async () => {
    const lookup = await loadPlayerModule(student.id, ids.a);
    expect(lookup.status).toBe("ok");
    if (lookup.status !== "ok") return;
    expect(lookup.data.interactions.map((i) => i.id)).toEqual([ids.q1, ids.q2, ids.q3]);
    expect(lookup.data.interactions[0].presentationStyle).toBe("MORAL_CHOICE");
    expect(lookup.data.virtues.length).toBeGreaterThan(0);
    expect(lookup.data.resumeSeconds).toBe(0);
    expect(JSON.stringify(lookup.data)).not.toMatch(FORBIDDEN);
  });

  // ------------------------------------------------------------------ saving answers

  it("saves the answer and the progress together, with the captured timing", async () => {
    const res = await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1a, responseTimeMs: 5100, replayCount: 2, positionSeconds: 10.4 });
    expect(res.status).toBe(200);
    const row = await responseOf(ids.q1);
    expect(row).toMatchObject({ selectedOptionId: ids.q1a, responseTimeMs: 5100, replayCount: 2, attemptCount: 1, isSkipped: false });
    const progress = await db.orm.public.ModuleProgress.where({ userId: student.id, moduleId: ids.a }).first();
    expect(progress?.lastPositionSeconds).toBeCloseTo(10.4);
    expect(progress?.completedAt).toBeNull();
    expect(progress?.startedAt).toBeInstanceOf(Date);
  });

  it("a SURVEY reply is neutral: no correctness, weight or score, whichever option was picked", async () => {
    for (const optionId of [ids.q1a, ids.q1b]) {
      const res = await answer(ids.a, { interactionId: ids.q1, optionId });
      const text = await res.text();
      expect(res.status).toBe(200);
      expect(text).not.toMatch(FORBIDDEN);
      expect(Object.keys(JSON.parse(text)).sort()).toEqual(["next", "type"]);
      expect(JSON.parse(text)).toEqual({ type: "SURVEY", next: { kind: "continue" } });
    }
  });

  it("re-answering replaces the answer and counts an attempt; a retry with the same key does not", async () => {
    const key = `retry-${randomUUID()}`;
    const first = await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1a, idempotencyKey: key });
    expect(first.status).toBe(200);
    const before = (await responseOf(ids.q1))!;
    const again = await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1a, idempotencyKey: key });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(await first.json());
    const after = (await responseOf(ids.q1))!;
    expect(after.attemptCount).toBe(before.attemptCount); // no duplicate attempt
    // A genuine re-answer (new key) is one more attempt, and the latest answer stands.
    await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1b });
    const changed = (await responseOf(ids.q1))!;
    expect(changed.attemptCount).toBe(before.attemptCount + 1);
    expect(changed.selectedOptionId).toBe(ids.q1b);
    // Put the "good" answer back for the scoring tests below.
    await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1a });
  });

  it("two simultaneous retries with one key still count one attempt", async () => {
    const key = `race-${randomUUID()}`;
    const before = (await responseOf(ids.q1))!.attemptCount;
    const results = await Promise.all([1, 2, 3].map(() => answer(ids.a, { interactionId: ids.q1, optionId: ids.q1b, idempotencyKey: key })));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect((await responseOf(ids.q1))!.attemptCount).toBe(before + 1);
    await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1a });
  });

  it("a QUIZ reply says only whether the guess matched", async () => {
    const wrong = await (await answer(ids.a, { interactionId: ids.q2, optionId: ids.q2wrong })).json();
    expect(wrong).toEqual({ type: "QUIZ", matched: false, next: { kind: "continue" } });
    const right = await (await answer(ids.a, { interactionId: ids.q2, optionId: ids.q2right })).text();
    expect(JSON.parse(right)).toEqual({ type: "QUIZ", matched: true, next: { kind: "continue" } });
    expect(right).not.toMatch(/isCorrect|correctOptionId|weight|score/i);
  });

  it("validates the request: option must belong to the question, key and timing are required, a required question cannot be skipped", async () => {
    expect((await answer(ids.a, { interactionId: ids.q1, optionId: ids.q2right })).status).toBe(400); // option of another question
    expect((await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1a, idempotencyKey: "short" })).status).toBe(400);
    expect((await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1a, responseTimeMs: -5 })).status).toBe(400);
    expect((await answer(ids.a, { interactionId: ids.q1, skip: true })).status).toBe(400); // required
    expect((await answer(ids.a, { interactionId: ids.q3, skip: true })).status).toBe(200); // skippable
    expect((await responseOf(ids.q3))?.isSkipped).toBe(true);
  });

  it("progress saves position and never completes the module", async () => {
    const res = await call(progressRoute as never, "PUT", student.token, ids.a, { positionSeconds: 55 });
    expect(res.status).toBe(200);
    const progress = await db.orm.public.ModuleProgress.where({ userId: student.id, moduleId: ids.a }).first();
    expect(progress?.lastPositionSeconds).toBe(55);
    expect(progress?.completedAt).toBeNull();
    expect((await call(progressRoute as never, "PUT", student.token, ids.a, { positionSeconds: "soon" })).status).toBe(400);
    // Resume goes to the saved point (the required questions before it are answered).
    const lookup = await loadPlayerModule(student.id, ids.a);
    expect(lookup.status === "ok" && lookup.data.resumeSeconds).toBe(55);
  });

  // ------------------------------------------------------------------ completion and rewards

  it("completion is refused while a required question is unanswered", async () => {
    // Module C has one required question and the student has not answered it.
    const res = await call(completeRoute as never, "POST", student.token, ids.c);
    expect(res.status).toBe(409);
    expect((await db.orm.public.ModuleProgress.where({ userId: student.id, moduleId: ids.c }).first())?.completedAt ?? null).toBeNull();
  });

  it("completes once, repeats safely, and returns rewards without numeric scores", async () => {
    expect((await getChildView(student.id)).modulesCompleted).toBe(0);

    const res = await call(completeRoute as never, "POST", student.token, ids.a);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/isCorrect|weight|score|percent/i);
    const rewards = JSON.parse(text);
    expect(Object.keys(rewards).sort()).toEqual(["badges", "followUpActivity", "grew", "journey", "nextModule", "stars", "totalStars"]);
    expect(rewards.followUpActivity).toBe("Try Module A at home.");
    expect(rewards.stars).toBeGreaterThanOrEqual(1);
    expect(rewards.badges.map((b: { title: string }) => b.title)).toContain("Story finished");
    expect(rewards.journey).toMatchObject({ title: "Test path" });
    expect(rewards.nextModule).toMatchObject({ moduleId: ids.c }); // B is still locked until C is done as well

    const first = (await db.orm.public.ModuleProgress.where({ userId: student.id, moduleId: ids.a }).first())!;
    expect(first.completedAt).toBeInstanceOf(Date);

    const repeat = await call(completeRoute as never, "POST", student.token, ids.a);
    expect(await repeat.json()).toEqual(rewards); // same rewards, no extra stars on a repeat
    const second = (await db.orm.public.ModuleProgress.where({ userId: student.id, moduleId: ids.a }).first())!;
    expect(second.completedAt?.getTime()).toBe(first.completedAt?.getTime()); // the date never moves

    // The scoring engine now counts the module.
    expect((await getChildView(student.id)).modulesCompleted).toBe(1);
    const assessment = await getAssessment(student.id);
    expect(assessment.virtues.find((v) => v.virtueId === virtueId)?.scoredInteractions).toBeGreaterThan(0);
  });

  it("a re-watch updates answers but keeps the completion date", async () => {
    const before = (await db.orm.public.ModuleProgress.where({ userId: student.id, moduleId: ids.a }).first())!.completedAt!.getTime();
    await answer(ids.a, { interactionId: ids.q1, optionId: ids.q1b });
    await call(completeRoute as never, "POST", student.token, ids.a);
    expect((await db.orm.public.ModuleProgress.where({ userId: student.id, moduleId: ids.a }).first())!.completedAt!.getTime()).toBe(before);
    expect((await responseOf(ids.q1))?.selectedOptionId).toBe(ids.q1b);
    // A completed module starts from the beginning.
    const lookup = await loadPlayerModule(student.id, ids.a);
    expect(lookup.status === "ok" && lookup.data.resumeSeconds).toBe(0);
  });

  it("finishing level 1 opens level 2", async () => {
    expect((await loadPlayerModule(student.id, ids.b)).status).toBe("locked");
    expect((await answer(ids.c, { interactionId: ids.qC, optionId: (await db.orm.public.InteractionOption.where({ interactionId: ids.qC }).first())!.id })).status).toBe(200);
    const done = await call(completeRoute as never, "POST", student.token, ids.c);
    expect(done.status).toBe(200);
    expect((await done.json()).nextModule).toMatchObject({ moduleId: ids.b });
    expect((await loadPlayerModule(student.id, ids.b)).status).toBe("ok");
    const open = await answer(ids.b, { interactionId: ids.qB, optionId: (await db.orm.public.InteractionOption.where({ interactionId: ids.qB }).first())!.id });
    expect(open.status).toBe(200);
  });

  // ------------------------------------------------------------------ the public /watch path

  it("/watch answers go through the same save and count attempts", async () => {
    const shareId = await enableSharing(teacher.id, ids.videoE);
    const mine = () => db.orm.public.InteractionResponse.where({ userId: student.id, interactionId: ids.qE }).first();
    expect(await checkPublicAnswer(shareId, ids.qE, { optionId: ids.qEopt[0] }, student.id)).toEqual({ type: "SURVEY" });
    expect((await mine())?.attemptCount).toBe(1);
    await checkPublicAnswer(shareId, ids.qE, { optionId: ids.qEopt[1] }, student.id);
    const row = (await mine())!;
    expect(row.attemptCount).toBe(2);
    expect(row.selectedOptionId).toBe(ids.qEopt[1]);
    await checkPublicAnswer(shareId, ids.qE, { skip: true }, student.id);
    expect((await mine())?.attemptCount).toBe(3);
    // Anonymous viewers still cannot answer.
    await expect(checkPublicAnswer(shareId, ids.qE, { optionId: ids.qEopt[0] }, null)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
