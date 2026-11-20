import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));

// Proves the DB itself rejects bad PARICHAY data (not just app code) and that the migration seeded the virtues.
describe("PARICHAY schema constraints", () => {
  const key = randomUUID();
  let userId = 0, videoId = 0, moduleId = 0, optionId = 0, otherVideoId = 0, interactionId = 0;
  let virtues: { id: number; slug: string; position: number }[] = [];
  const pos = (n: number) => virtues[n - 1].id; // virtue id by display position

  beforeAll(async () => {
    virtues = await db.orm.public.Virtue.orderBy((v) => v.position.asc()).all();
    userId = (await db.orm.public.User.create({ name: "Schema Tester", email: `schema-${key}@example.com`, password: "hash", role: "TEACHER" })).id;
    const video = (n: string) =>
      db.orm.public.Video.create({ title: "T", fileUrl: `https://example.ufs.sh/f/${n}`, duration: 60, mimeType: "video/mp4", originalName: "t.mp4", sizeBytes: 1, fileKey: `${key}-${n}`, uploaderId: userId });
    videoId = (await video("a")).id;
    otherVideoId = (await video("b")).id;
    moduleId = (
      await db.orm.public.Module.create({
        videoId,
        sourceStory: "The Honest Woodcutter",
        primaryVirtueId: pos(8),
        ageBand: "8-9",
        learningObjective: "Tell the truth when it is hard",
        discussionPrompts: ["Why did he tell the truth?"],
        followUpActivity: "Tell someone about a time you were honest.",
      })
    ).id;
    interactionId = (await db.orm.public.Interaction.create({ videoId, timestamp: 5, type: "SURVEY", question: "What would you do?" })).id;
    optionId = (await db.orm.public.InteractionOption.create({ interactionId, text: "Tell the truth", position: 0 })).id;
  });

  afterAll(async () => {
    // Cascades remove modules, interactions, options, weights, progress and ratings.
    await db.orm.public.Video.where({ uploaderId: userId }).deleteAll();
    await db.orm.public.User.where({ id: userId }).deleteAll();
  });

  it("seeds exactly the 10 virtues in the fixed order", () => {
    expect(virtues.map((v) => v.slug)).toEqual([
      "self-discipline", "compassion", "responsibility", "friendship", "work", "courage", "perseverance", "honesty", "loyalty", "faith",
    ]);
    expect(virtues.map((v) => v.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("rejects an option weight of 3, -3 or 0, and accepts -2..2", async () => {
    const make = (weight: number, virtueId = pos(1)) => db.orm.public.OptionVirtueWeight.create({ optionId, virtueId, weight });
    for (const bad of [3, -3, 0]) await expect(make(bad)).rejects.toThrow();
    await expect(make(-2, pos(2))).resolves.toBeTruthy();
    await expect(make(2, pos(3))).resolves.toBeTruthy();
  });

  it("rejects a duplicate (option, virtue) weight", async () => {
    await db.orm.public.OptionVirtueWeight.create({ optionId, virtueId: pos(4), weight: 1 });
    await expect(db.orm.public.OptionVirtueWeight.create({ optionId, virtueId: pos(4), weight: 2 })).rejects.toThrow();
  });

  it("rejects a rating of 0 or 6 and accepts 1..5", async () => {
    const make = (rating: number) => db.orm.public.VirtueRating.create({ studentId: userId, raterKind: "PARENT", raterName: "A Parent", virtueId: pos(1), rating });
    for (const bad of [0, 6]) await expect(make(bad)).rejects.toThrow();
    for (const ok of [1, 5]) await expect(make(ok)).resolves.toBeTruthy();
  });

  it("limits a module to 2 secondary virtues, never the primary", async () => {
    const add = (virtueId: number, position: number) =>
      db.orm.public.ModuleSecondaryVirtue.create({ moduleId, virtueId, primaryVirtueId: pos(8), position });
    await expect(add(pos(8), 1)).rejects.toThrow(); // primary used as secondary
    await expect(add(pos(1), 1)).resolves.toBeTruthy();
    await expect(add(pos(2), 2)).resolves.toBeTruthy();
    await expect(add(pos(3), 3)).rejects.toThrow(); // a 3rd (position outside 1..2)
    await expect(add(pos(3), 1)).rejects.toThrow(); // position 1 already taken
    await expect(add(pos(1), 2)).rejects.toThrow(); // same virtue twice
  });

  it("rejects a secondary row whose primaryVirtueId does not mirror the module's", async () => {
    await expect(db.orm.public.ModuleSecondaryVirtue.create({ moduleId, virtueId: pos(5), primaryVirtueId: pos(7), position: 1 })).rejects.toThrow();
  });

  it("makes a Module 1:1 with a Video", async () => {
    await expect(
      db.orm.public.Module.create({ videoId, sourceStory: "x", primaryVirtueId: pos(1), ageBand: "10-12", learningObjective: "x", discussionPrompts: [], followUpActivity: "x" }),
    ).rejects.toThrow();
  });

  it("rejects an invalid age band, a journey level below 1 and a duplicate level position", async () => {
    await expect(
      db.orm.public.Module.create({ videoId: otherVideoId, sourceStory: "x", primaryVirtueId: pos(1), ageBand: "13-15" as never, learningObjective: "x", discussionPrompts: [], followUpActivity: "x" }),
    ).rejects.toThrow();
    const journey = await db.orm.public.Journey.create({ title: "J", description: "d", displayOrder: 1 });
    await expect(db.orm.public.JourneyModule.create({ journeyId: journey.id, moduleId, level: 0, position: 0 })).rejects.toThrow();
    await expect(db.orm.public.JourneyModule.create({ journeyId: journey.id, moduleId, level: 1, position: 0 })).resolves.toBeTruthy();
    await db.orm.public.Journey.where({ id: journey.id }).deleteAll();
  });

  it("defaults presentation style and response capture so existing rows are unaffected", async () => {
    const i = await db.orm.public.Interaction.where({ id: interactionId }).first();
    expect(i?.presentationStyle).toBe("MORAL_CHOICE");
    const r = await db.orm.public.InteractionResponse.create({ userId, interactionId, selectedOptionId: optionId, isSkipped: false });
    expect(r.responseTimeMs).toBeNull();
    expect(r.replayCount).toBe(0);
    expect(r.attemptCount).toBe(1);
    await expect(db.orm.public.InteractionResponse.where({ id: r.id }).updateAll({ attemptCount: 0 })).rejects.toThrow();
    await expect(db.orm.public.InteractionResponse.where({ id: r.id }).updateAll({ replayCount: -1 })).rejects.toThrow();
  });

  it("allows completedAt to be backdated on module progress, one row per user and module", async () => {
    const completedAt = new Date("2026-05-01T00:00:00Z");
    const p = await db.orm.public.ModuleProgress.create({ userId, moduleId, startedAt: completedAt, lastPositionSeconds: 12, completedAt });
    expect(p.completedAt?.toISOString()).toBe(completedAt.toISOString());
    await expect(db.orm.public.ModuleProgress.create({ userId, moduleId })).rejects.toThrow();
  });
});
