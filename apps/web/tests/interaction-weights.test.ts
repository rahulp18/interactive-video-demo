import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getVideoRoute } from "@/app/api/videos/[id]/route";
import { POST as createInteractionRoute } from "@/app/api/videos/[id]/interactions/route";
import { PUT as putInteractionRoute } from "@/app/api/videos/[id]/interactions/[interactionId]/route";
import { createSession } from "@/lib/auth/session";
import { hasWeights, validateInteraction, type InteractionDTO } from "@/lib/interactions/model";
import { getEditorModule } from "@/lib/interactions/service";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("uploadthing/server", () => ({
  UTApi: class {
    deleteFiles = vi.fn(async () => ({ success: true, deletedCount: 1 }));
  },
  UploadThingError: class extends Error {},
}));

const ORIGIN = "http://localhost:3000";
const DURATION = 120;

describe("story-module question validation (pure)", () => {
  const MODULE = { moduleVirtueIds: [7, 5] };
  const base = {
    type: "SURVEY",
    timestamp: 10,
    question: "What should Tortoise do?",
    presentationStyle: "MORAL_CHOICE",
    options: [
      { text: "Keep going", weights: { 7: 2, 5: 1 } },
      { text: "Stop", weights: { "7": -2, 5: 0 } },
    ],
  };

  it("keeps style and non-zero weights for the module's virtues", () => {
    const r = validateInteraction(base, DURATION, MODULE);
    expect(r.errors).toBeUndefined();
    expect(r.value?.presentationStyle).toBe("MORAL_CHOICE");
    expect(r.value?.options.map((o) => o.weights)).toEqual([{ 7: 2, 5: 1 }, { 7: -2 }]);
  });

  it("defaults the style and rejects unknown ones", () => {
    expect(validateInteraction({ ...base, presentationStyle: undefined }, DURATION, MODULE).value?.presentationStyle).toBe("MORAL_CHOICE");
    expect(validateInteraction({ ...base, presentationStyle: "QUIZ_SHOW" }, DURATION, MODULE).errors).toHaveProperty("presentationStyle");
  });

  it("rejects weights out of range, non-integers and virtues not on the module", () => {
    for (const weights of [{ 7: 3 }, { 7: -3 }, { 7: 1.5 }, { 7: "2" }, { 1: 1 }, { abc: 1 }, [1]]) {
      const r = validateInteraction({ ...base, options: [{ text: "a", weights }, { text: "b" }] }, DURATION, MODULE);
      expect(r.errors).toHaveProperty("options.0.weights");
    }
  });

  it("refuses typed answers on a module and needs exactly 5 options for RATING", () => {
    expect(validateInteraction({ ...base, answerType: "TEXT", options: [] }, DURATION, MODULE).errors).toHaveProperty("answerType");
    expect(validateInteraction({ ...base, presentationStyle: "RATING" }, DURATION, MODULE).errors).toHaveProperty("options");
    const five = Array.from({ length: 5 }, (_, i) => ({ text: `${i + 1}` }));
    expect(validateInteraction({ ...base, presentationStyle: "RATING", options: five }, DURATION, MODULE).errors).toBeUndefined();
  });

  it("plain videos take no weights and keep the default style", () => {
    expect(validateInteraction(base, DURATION).errors).toHaveProperty("options.0.weights");
    const plain = validateInteraction({ ...base, presentationStyle: "EMOTION", options: [{ text: "a" }, { text: "b", weights: {} }] }, DURATION);
    expect(plain.errors).toBeUndefined();
    expect(plain.value?.presentationStyle).toBe("MORAL_CHOICE");
    expect(plain.value?.options.every((o) => o.weights === undefined)).toBe(true);
    // Typed answers stay available for plain videos.
    expect(validateInteraction({ ...base, options: [], answerType: "TEXT" }, DURATION).errors).toBeUndefined();
  });

  it("hasWeights is true only when some option weighs a virtue", () => {
    expect(hasWeights([{ weights: {} }, { weights: {} }])).toBe(false);
    expect(hasWeights([{ weights: {} }, { weights: { 3: -1 } }])).toBe(true);
  });
});

describe("story-module questions through the API", () => {
  const email = `weights-${randomUUID()}@example.com`;
  let token = "";
  let userId = 0;
  let moduleVideo = 0;
  let plainVideo = 0;
  const virtue: Record<string, number> = {};

  const req = (method: string, path: string, body?: unknown) =>
    new Request(`${ORIGIN}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body !== undefined && { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) }) as never;
  const create = (videoId: number, body: unknown) => createInteractionRoute(req("POST", `/api/videos/${videoId}/interactions`, body), params({ id: String(videoId) }));
  const put = (videoId: number, id: number, body: unknown) =>
    putInteractionRoute(req("PUT", `/api/videos/${videoId}/interactions/${id}`, body), params({ id: String(videoId), interactionId: String(id) }));
  async function makeVideo(title: string) {
    const key = `key-${randomUUID()}`;
    const v = await db.orm.public.Video.create({
      title, fileUrl: `https://example.ufs.sh/f/${key}`, duration: DURATION, mimeType: "video/mp4",
      originalName: `${title}.mp4`, sizeBytes: 10, fileKey: key, uploaderId: userId,
    });
    return v.id;
  }

  beforeAll(async () => {
    for (const v of await db.orm.public.Virtue.all()) virtue[v.slug] = v.id;
    const user = await db.orm.public.User.create({ name: "Weights teacher", email, password: "x", role: "TEACHER" });
    userId = user.id;
    token = (await createSession(user.id)).token;
    moduleVideo = await makeVideo("Story");
    plainVideo = await makeVideo("Plain");
    const mod = await db.orm.public.Module.create({
      videoId: moduleVideo, sourceStory: "Test story", primaryVirtueId: virtue.perseverance, ageBand: "8-9",
      learningObjective: "Keep going", discussionPrompts: ["Why?"], followUpActivity: "Practise",
    });
    await db.orm.public.ModuleSecondaryVirtue.create({ moduleId: mod.id, virtueId: virtue.work, primaryVirtueId: virtue.perseverance, position: 1 });
  });

  afterAll(async () => {
    const user = await db.orm.public.User.where({ email }).first();
    if (user) {
      await db.orm.public.Video.where({ uploaderId: user.id }).deleteAll();
      await db.orm.public.User.where({ id: user.id }).deleteAll();
    }
  });

  it("describes the module for the editor, primary virtue first; plain videos have none", async () => {
    const mod = await getEditorModule(userId, moduleVideo);
    expect(mod?.status).toBe("DRAFT");
    expect(mod?.virtues.map((v) => [v.slug, v.role])).toEqual([["perseverance", "primary"], ["work", "secondary"]]);
    expect(await getEditorModule(userId, plainVideo)).toBeNull();
  });

  it("round-trips style and weights, and preserves weights for virtues that are not on the module", async () => {
    const res = await create(moduleVideo, {
      type: "SURVEY", timestamp: 12, question: "What should Tortoise do?", presentationStyle: "SITUATIONAL",
      options: [{ text: "Keep going", weights: { [virtue.perseverance]: 2, [virtue.work]: 1 } }, { text: "Stop", weights: { [virtue.perseverance]: -2 } }],
    });
    expect(res.status).toBe(201);
    const created: InteractionDTO = (await res.json()).interaction;
    expect(created.presentationStyle).toBe("SITUATIONAL");
    expect(created.options.map((o) => o.weights)).toEqual([{ [virtue.perseverance]: 2, [virtue.work]: 1 }, { [virtue.perseverance]: -2 }]);

    // A weight for a virtue that is no longer on the module (e.g. a removed secondary) must survive edits.
    const [keep, stop] = created.options;
    await db.orm.public.OptionVirtueWeight.create({ optionId: keep.id, virtueId: virtue.honesty, weight: 1 });

    const updated = await put(moduleVideo, created.id, {
      type: "SURVEY", timestamp: 12, question: "What should Tortoise do now?", presentationStyle: "EMOTION",
      options: [
        { id: keep.id, text: "Keep going", weights: { [virtue.perseverance]: 1 } },
        { id: stop.id, text: "Stop", weights: {} },
        { text: "Rest a bit", weights: { [virtue.work]: -1 } },
      ],
    });
    expect(updated.status).toBe(200);
    const after: InteractionDTO = (await updated.json()).interaction;
    expect(after.presentationStyle).toBe("EMOTION");
    expect(after.options.map((o) => o.weights)).toEqual([{ [virtue.perseverance]: 1, [virtue.honesty]: 1 }, {}, { [virtue.work]: -1 }]);

    const detail = await (await getVideoRoute(req("GET", `/api/videos/${moduleVideo}`), params({ id: String(moduleVideo) }))).json();
    expect(detail.interactions[0].options[0].weights).toEqual({ [virtue.perseverance]: 1, [virtue.honesty]: 1 });
  });

  it("rejects weights for virtues not on the module and typed answers on a module", async () => {
    const foreign = await create(moduleVideo, {
      type: "SURVEY", timestamp: 20, question: "Q", options: [{ text: "a", weights: { [virtue.honesty]: 1 } }, { text: "b" }],
    });
    expect(foreign.status).toBe(400);
    expect((await foreign.json()).error.fields).toHaveProperty("options.0.weights");
    const text = await create(moduleVideo, { type: "SURVEY", answerType: "TEXT", timestamp: 20, question: "Q", options: [] });
    expect(text.status).toBe(400);
    expect((await text.json()).error.fields).toHaveProperty("answerType");
  });

  it("plain videos refuse weights and ignore the style", async () => {
    const weighted = await create(plainVideo, { type: "SURVEY", timestamp: 5, question: "Q", options: [{ text: "a", weights: { [virtue.work]: 1 } }, { text: "b" }] });
    expect(weighted.status).toBe(400);
    const res = await create(plainVideo, { type: "SURVEY", timestamp: 5, question: "Q", presentationStyle: "RATING", options: [{ text: "a" }, { text: "b" }] });
    expect(res.status).toBe(201);
    const created: InteractionDTO = (await res.json()).interaction;
    expect(created.presentationStyle).toBe("MORAL_CHOICE");
    expect(created.options.every((o) => Object.keys(o.weights).length === 0)).toBe(true);
  });
});
