import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/prisma/db";
import { getAssessment, getChildView } from "@/lib/scoring/service";
import { validateParentMarks, type Assessment } from "@/lib/scoring";
import { CLIPS, JOURNEYS, MODULES, RATING_LABELS, VIRTUE_SLUGS, demoFileKey } from "@/scripts/demo/content";
import { DEMO_EMAIL_DOMAIN, isDemoEmail } from "@/scripts/demo/content/accounts";
import { COMPLETED, IN_PROGRESS, NOT_STARTED, RATINGS } from "@/scripts/demo/content/history";
import { offlineAssessment, offlineChildView, resolvePicks } from "@/scripts/demo/profile";
import { assertDemoUser, clearStudentHistory, ensureAccounts, resetStudent, seedContent, seedJourneys, seedStudentHistory } from "@/scripts/demo/seed-lib";

vi.mock("server-only", () => ({}));

const slugOfId = (id: number) => VIRTUE_SLUGS[id - 1]; // offline model: virtue id = display position

// ------------------------------------------------------------------ content (pure)

describe("demo content is valid", () => {
  it("has 10 modules and every virtue is primary in exactly one", () => {
    expect(MODULES).toHaveLength(10);
    for (const slug of VIRTUE_SLUGS) expect(MODULES.filter((m) => m.primary === slug), slug).toHaveLength(1);
    expect(new Set(MODULES.map((m) => m.slug)).size).toBe(10);
  });

  it.each(MODULES.map((m) => [m.slug, m] as const))("%s: metadata is complete", (_slug, m) => {
    expect(m.secondary.length).toBeGreaterThanOrEqual(1);
    expect(m.secondary.length).toBeLessThanOrEqual(2);
    expect(m.secondary).not.toContain(m.primary);
    expect(new Set(m.secondary).size).toBe(m.secondary.length);
    expect(["8-9", "10-12"]).toContain(m.ageBand);
    expect(m.learningObjective.split(/[.!?]\s/).length).toBe(1); // one sentence
    expect(m.discussionPrompts.length).toBeGreaterThanOrEqual(2);
    expect(m.discussionPrompts.length).toBeLessThanOrEqual(3);
    expect(m.followUp.length).toBeGreaterThan(20);
    expect(m.sourceStory).toMatch(/\(.+\)/);
    expect(m.script.length).toBeGreaterThan(200);
    expect(CLIPS[m.clip]).toBeDefined();
  });

  it.each(MODULES.map((m) => [m.slug, m] as const))("%s: questions are well formed and scorable", (_slug, m) => {
    expect(m.questions.length).toBeGreaterThanOrEqual(3);
    expect(m.questions.length).toBeLessThanOrEqual(6);
    expect(m.questions.some((q) => q.style === "SITUATIONAL")).toBe(true);
    const allowed = new Set([m.primary, ...m.secondary]);
    const duration = CLIPS[m.clip].duration;
    let last = 0;
    for (const q of m.questions) {
      const t = q.at * duration;
      expect(t).toBeGreaterThan(last + 10); // spread out, not clustered
      expect(t).toBeLessThan(duration - 5);
      last = t;

      expect(q.options.length).toBeGreaterThanOrEqual(3);
      if (q.style === "RATING") {
        expect(q.options.map((o) => o.text)).toEqual([...RATING_LABELS]);
        expect(q.options).toHaveLength(5);
      } else {
        for (const tone of ["good", "neutral", "poor"] as const) expect(q.options.filter((o) => o.tone === tone), `${q.question} ${tone}`).toHaveLength(1);
      }
      if (q.style === "EMOTION") for (const o of q.options) expect(o.text.codePointAt(0)!).toBeGreaterThan(0x2000); // starts with an emoji

      // Scoring spread: a clearly good option, a neutral option with no weight rows, a poor option with -1/-2.
      const weights = q.options.map((o) => Object.entries(o.w ?? {}));
      expect(weights.some((w) => w.length === 0), `${q.question}: needs a neutral option`).toBe(true);
      expect(weights.flat().some(([, v]) => v > 0), `${q.question}: needs a positive option`).toBe(true);
      expect(weights.flat().some(([, v]) => v < 0), `${q.question}: needs a negative option`).toBe(true);
      const virtues = new Set(weights.flat().map(([s]) => s));
      for (const [slug, v] of weights.flat()) {
        expect(allowed.has(slug as never), `${q.question}: ${slug} is not a virtue of this module`).toBe(true);
        expect(Number.isInteger(v) && v >= -2 && v <= 2 && v !== 0).toBe(true);
      }
      for (const w of weights) expect(w.length).toBeLessThanOrEqual(2); // each option weighs 1-2 virtues
      for (const slug of virtues) {
        const vals = q.options.map((o) => o.w?.[slug as never] ?? 0);
        expect(Math.max(...vals), `${q.question}: ${slug} has no spread`).toBeGreaterThan(Math.min(...vals));
      }
      expect(q.type ?? "SURVEY").toBe("SURVEY");
      if (q.style !== "RATING") expect(new Set(q.options.map((o) => o.text)).size).toBe(q.options.length);
    }
  });

  it("uses encouraging, child-level language", () => {
    const text = MODULES.flatMap((m) => m.questions.flatMap((q) => [q.question, ...q.options.map((o) => o.text)])).join("\n");
    expect(text).not.toMatch(/\b(bad|selfish|stupid|lazy|naughty|dumb|evil|wicked)\b/i);
    // Faith is pluralistic: hope, gratitude, reverence for life; nothing tied to one religion.
    const faith = MODULES.find((m) => m.primary === "faith")!;
    const faithText = JSON.stringify(faith);
    expect(faithText).not.toMatch(/\b(god|gods|temple|church|mosque|pray|prayer|heaven|bible|quran|allah)\b/i);
  });

  it("groups all 10 modules into 3 journeys with 2 levels each", () => {
    expect(JOURNEYS).toHaveLength(3);
    for (const j of JOURNEYS) expect(j.levels).toHaveLength(2);
    const all = JOURNEYS.flatMap((j) => j.levels.flat());
    expect([...all].sort()).toEqual(MODULES.map((m) => m.slug).sort());
  });

  it("keeps every clip's attribution in the manifest", () => {
    for (const c of Object.values(CLIPS)) {
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.duration).toBeGreaterThan(60);
      expect(c.attribution.length).toBeGreaterThan(5);
      expect(c.licence).toMatch(/CC/);
    }
  });

  it("has a valid designed history", () => {
    for (const c of COMPLETED) {
      const m = MODULES.find((x) => x.slug === c.slug)!;
      expect(c.picks).toHaveLength(m.questions.length);
      expect(resolvePicks(m, c.picks)).toHaveLength(m.questions.length);
    }
    const mango = MODULES.find((x) => x.slug === IN_PROGRESS.slug)!;
    expect(IN_PROGRESS.picks.length).toBeGreaterThanOrEqual(1);
    expect(IN_PROGRESS.picks.length).toBeLessThan(mango.questions.length);
    expect(new Set([...COMPLETED.map((c) => c.slug), IN_PROGRESS.slug, ...NOT_STARTED]).size).toBe(10);
    for (const set of RATINGS) expect(validateParentMarks(Object.values(set.ratings).map(([, mark]) => mark))).toBeNull();
    const parents = RATINGS.filter((r) => r.raterKind === "PARENT");
    expect(parents.length).toBeGreaterThanOrEqual(2); // an older set is kept
    for (const p of parents) expect(Object.keys(p.ratings)).toHaveLength(10);
    // Backdated over about four months.
    expect(Math.max(...COMPLETED.map((c) => c.daysAgo))).toBeGreaterThan(100);
  });
});

// ------------------------------------------------------------------ the designed profile

/** Asserts every row of the target profile. `slugOf` maps the assessment's virtue ids to slugs. */
function expectTargetProfile(a: Assessment, slugOf: (id: number) => string) {
  const v = (slug: string) => a.virtues.find((x) => slugOf(x.virtueId) === slug)!;
  const names = (items: { virtueId: number }[]) => items.map((i) => slugOf(i.virtueId));

  // Strengths: composite >= 70, trend not falling.
  expect(names(a.swot.strengths)).toEqual(expect.arrayContaining(["compassion", "friendship"]));
  for (const s of ["compassion", "friendship"]) {
    expect(v(s).compositeScore!).toBeGreaterThanOrEqual(70);
    expect(v(s).trend).not.toBe("falling");
  }
  // Weakness by score.
  expect(v("self-discipline").compositeScore!).toBeLessThan(45);
  expect(names(a.swot.weaknesses)).toContain("self-discipline");
  // Weakness by parent mark (composite is NOT below 45, so only the mark + child < 60 explains it).
  expect(v("honesty").parentMark).toBe("IMPROVE");
  expect(v("honesty").childScore!).toBeLessThan(60);
  expect(v("honesty").compositeScore!).toBeGreaterThanOrEqual(45);
  expect(names(a.swot.weaknesses)).toContain("honesty");
  // Opportunity: 45-70 and rising.
  expect(v("perseverance").compositeScore!).toBeGreaterThanOrEqual(45);
  expect(v("perseverance").compositeScore!).toBeLessThan(70);
  expect(v("perseverance").trend).toBe("rising");
  expect(names(a.swot.opportunities)).toContain("perseverance");
  // Threat: decline of at least 15 within the 90-day window.
  expect(v("responsibility").trendDelta!).toBeLessThanOrEqual(-15);
  expect(names(a.swot.threats)).toContain("responsibility");
  // Threat: large parent / child gap.
  expect(Math.abs(v("work").parentScore! - v("work").childScore!)).toBeGreaterThanOrEqual(30);
  expect(names(a.swot.threats)).toContain("work");
  // Not enough data, and so left out of the SWOT.
  expect(v("faith").confidence).toBe("insufficient");
  expect(v("faith").scoredInteractions).toBeLessThan(8);
  for (const list of [a.swot.strengths, a.swot.weaknesses, a.swot.opportunities, a.swot.threats]) expect(names(list)).not.toContain("faith");
  // Confidence spread across the rest.
  expect(v("compassion").confidence).toBe("high");
  expect(v("friendship").confidence).toBe("medium");
  const rest = a.virtues.filter((x) => !["faith", "compassion", "friendship"].includes(slugOf(x.virtueId)));
  expect(rest.every((x) => x.confidence === "low")).toBe(true);
  expect(new Set(a.virtues.map((x) => x.confidence))).toEqual(new Set(["insufficient", "low", "medium", "high"]));
  // Every quadrant has an item, with evidence and a reason.
  for (const list of [a.swot.strengths, a.swot.weaknesses, a.swot.opportunities, a.swot.threats]) {
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(item.reason.length).toBeGreaterThan(10);
      expect(item.evidenceResponseIds.length).toBeLessThanOrEqual(3);
    }
  }
  expect(a.swot.strengths.every((s) => s.evidenceResponseIds.length > 0)).toBe(true);
  // Unintended side effects: only Responsibility declines; only Work has a gap.
  expect(names(a.swot.threats).sort()).toEqual(["responsibility", "work"]);
  expect(a.ruleVersion).toBe("v1");
}

describe("designed profile (offline, no database)", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  it("hits every row of the target profile under SCORING_RULES_V1", () => {
    expectTargetProfile(offlineAssessment(now), slugOfId);
  });
  it("is stable across dates, because everything is relative to now", () => {
    expectTargetProfile(offlineAssessment(new Date("2027-03-01T12:00:00Z")), slugOfId);
  });
  it("gives the child superpowers and several badges", () => {
    const view = offlineChildView(now);
    expect(view.superpowers.length).toBeGreaterThanOrEqual(2);
    expect(view.badges.length).toBeGreaterThanOrEqual(8);
    expect(view.badges.some((b) => b.kind === "journey-level")).toBe(true);
    expect(view.badges.some((b) => b.kind === "virtue")).toBe(true);
    expect(view.stars.total).toBeGreaterThan(10);
    expect(view.modulesCompleted).toBe(COMPLETED.length);
  });
});

// ------------------------------------------------------------------ database

describe("demo seed against the database", () => {
  const throwaway: number[] = [];
  let ownerId = 0;
  let virtueSlugById = new Map<number, string>();

  // NOTE: demo accounts are created if missing. A password is only set on creation, so an existing DEMO_PASSWORD is never changed.
  const password = process.env["DEMO_PASSWORD"] && process.env["DEMO_PASSWORD"]!.length >= 8 ? process.env["DEMO_PASSWORD"]! : randomUUID();

  async function makeStudent() {
    const u = await db.orm.public.User.create({ name: "Throwaway Student", email: `test-${randomUUID()}@${DEMO_EMAIL_DOMAIN}`, password: "hash", role: "STUDENT" });
    throwaway.push(u.id);
    return u.id;
  }
  const slugOf = (id: number) => virtueSlugById.get(id)!;
  const counts = async () => {
    const keys = MODULES.map((m) => demoFileKey(m.slug));
    const videos = await db.orm.public.Video.where((v) => v.fileKey.in(keys)).all();
    const videoIds = videos.map((v) => v.id);
    const interactions = await db.orm.public.Interaction.where((i) => i.videoId.in(videoIds)).all();
    const interactionIds = interactions.map((i) => i.id);
    const options = await db.orm.public.InteractionOption.where((o) => o.interactionId.in(interactionIds)).all();
    const modules = await db.orm.public.Module.where((m) => m.videoId.in(videoIds)).all();
    return {
      videos: videos.length,
      modules: modules.length,
      secondaries: (await db.orm.public.ModuleSecondaryVirtue.where((s) => s.moduleId.in(modules.map((m) => m.id))).all()).length,
      interactions: interactions.length,
      options: options.length,
      weights: (await db.orm.public.OptionVirtueWeight.where((w) => w.optionId.in(options.map((o) => o.id))).all()).length,
      journeys: (await db.orm.public.Journey.where((j) => j.title.in(JOURNEYS.map((x) => x.title))).all()).length,
    };
  };

  beforeAll(async () => {
    virtueSlugById = new Map((await db.orm.public.Virtue.all()).map((v) => [v.id, v.slug]));
    ownerId = (await ensureAccounts(password)).content;
  }, 60_000);

  afterAll(async () => {
    for (const id of throwaway) await db.orm.public.User.where({ id }).deleteAll();
  });

  it("seeds the content, and a second run changes nothing", async () => {
    const first = await seedContent(ownerId);
    await seedJourneys(first.moduleIds);
    const before = await counts();
    expect(before).toMatchObject({ videos: 10, modules: 10, interactions: MODULES.reduce((n, m) => n + m.questions.length, 0), journeys: 3 });
    expect(before.options).toBe(MODULES.reduce((n, m) => n + m.questions.reduce((k, q) => k + q.options.length, 0), 0));
    expect(before.weights).toBe(MODULES.reduce((n, m) => n + m.questions.reduce((k, q) => k + q.options.reduce((c, o) => c + Object.keys(o.w ?? {}).length, 0), 0), 0));

    const second = await seedContent(ownerId);
    const secondJourneys = await seedJourneys(second.moduleIds);
    expect(second.stats).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(secondJourneys).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(await counts()).toEqual(before);
    expect(second.moduleIds).toEqual(first.moduleIds);
  }, 300_000);

  it("stores each module as published, shared (unlisted) and owned by the content team", async () => {
    const owner = await db.orm.public.User.where({ id: ownerId }).first();
    expect(owner?.role).toBe("TEACHER");
    for (const m of MODULES) {
      const video = await db.orm.public.Video.where({ fileKey: demoFileKey(m.slug) }).first();
      expect(video?.uploaderId).toBe(ownerId);
      expect(video?.shareId).toMatch(/^[A-Za-z0-9_-]{16}$/);
      expect(video?.isListed).toBe(false);
      expect(video?.duration).toBe(CLIPS[m.clip].duration);
      const moduleRow = await db.orm.public.Module.where({ videoId: video!.id }).first();
      expect(moduleRow?.status).toBe("PUBLISHED");
      expect(moduleRow?.discussionPrompts).toEqual(m.discussionPrompts);
      const interactions = (await db.orm.public.Interaction.where({ videoId: video!.id }).all()).sort((a, b) => a.timestamp - b.timestamp);
      expect(interactions.map((i) => i.question)).toEqual(m.questions.map((q) => q.question));
      for (const i of interactions) {
        expect(i.timestamp).toBeLessThan(video!.duration);
        expect(i.isSkippable).toBe(false);
        expect(i.answerType).toBe("CHOICE");
      }
      expect(interactions.map((i) => i.presentationStyle)).toEqual(m.questions.map((q) => q.style));
    }
  }, 120_000);

  it("seeds the designed history for a throwaway student and produces the target profile", async () => {
    const studentId = await makeStudent();
    await seedContent(ownerId);
    const written = await seedStudentHistory(studentId);
    expect(written.progress).toBe(COMPLETED.length + 1);
    expect(written.ratings).toBe(RATINGS.reduce((n, r) => n + Object.keys(r.ratings).length, 0));

    const a = await getAssessment(studentId);
    expectTargetProfile(a, slugOf);

    const child = await getChildView(studentId);
    expect(child.superpowers.length).toBeGreaterThanOrEqual(2);
    expect(child.badges.length).toBeGreaterThanOrEqual(8);
    expect(child.ruleVersion).toBe("v1");

    // The open modules: one in progress (not complete, answers saved), one not started.
    const progress = await db.orm.public.ModuleProgress.where({ userId: studentId }).all();
    const mango = MODULES.find((m) => m.slug === IN_PROGRESS.slug)!;
    const mangoModule = await db.orm.public.Module.where({ videoId: (await db.orm.public.Video.where({ fileKey: demoFileKey(mango.slug) }).first())!.id }).first();
    const inProgress = progress.find((p) => p.moduleId === mangoModule!.id)!;
    expect(inProgress.completedAt).toBeNull();
    expect(inProgress.lastPositionSeconds).toBeGreaterThan(0);
    for (const slug of NOT_STARTED) {
      const video = await db.orm.public.Video.where({ fileKey: demoFileKey(slug) }).first();
      const moduleRow = await db.orm.public.Module.where({ videoId: video!.id }).first();
      expect(progress.some((p) => p.moduleId === moduleRow!.id)).toBe(false);
    }
    // Capture data is present.
    const responses = await db.orm.public.InteractionResponse.where({ userId: studentId }).all();
    expect(responses.length).toBe(COMPLETED.length * 5 + IN_PROGRESS.picks.length);
    expect(responses.every((r) => r.responseTimeMs !== null && r.responseTimeMs > 0)).toBe(true);
    expect(responses.some((r) => r.replayCount > 0)).toBe(true);
  }, 300_000);

  it("demo:reset brings a modified student back to the same assessment", async () => {
    const studentId = await makeStudent();
    await seedContent(ownerId);
    await seedStudentHistory(studentId);
    const original = await getAssessment(studentId);

    // Mess it up the way a rehearsal would: re-answer, add progress, drop ratings.
    const responses = await db.orm.public.InteractionResponse.where({ userId: studentId }).all();
    for (const r of responses.slice(0, 6)) await db.orm.public.InteractionResponse.where({ id: r.id }).updateAll({ attemptCount: 3 });
    await db.orm.public.VirtueRating.where({ studentId }).deleteAll();
    await db.orm.public.ModuleProgress.where({ userId: studentId }).updateAll({ completedAt: new Date() });
    const messed = await getAssessment(studentId);
    expect(JSON.stringify(messed.virtues.map((v) => v.compositeScore))).not.toBe(JSON.stringify(original.virtues.map((v) => v.compositeScore)));

    await resetStudent(studentId);
    const restored = await getAssessment(studentId);
    expectTargetProfile(restored, slugOf);
    const summary = (a: Assessment) =>
      a.virtues.map((v) => [v.virtueId, v.childScore?.toFixed(4), v.parentScore, v.teacherScore, v.compositeScore?.toFixed(4), v.confidence, v.trend, v.trendDelta?.toFixed(4), v.parentMark]);
    expect(summary(restored)).toEqual(summary(original));
    expect(restored.swot.strengths.map((s) => s.virtueId)).toEqual(original.swot.strengths.map((s) => s.virtueId));
    expect(restored.swot.threats.map((s) => s.virtueId)).toEqual(original.swot.threats.map((s) => s.virtueId));
  }, 300_000);

  it("only ever touches demo accounts, and leaves other users alone", async () => {
    const stranger = await db.orm.public.User.create({ name: "Real Person", email: `real-${randomUUID()}@example.com`, password: "hash", role: "STUDENT" });
    try {
      expect(isDemoEmail(stranger.email)).toBe(false);
      await expect(assertDemoUser(stranger.id)).rejects.toThrow(/not a demo account/);
      await expect(clearStudentHistory(stranger.id)).rejects.toThrow(/not a demo account/);
      await expect(seedStudentHistory(stranger.id)).rejects.toThrow(/not a demo account/);
      await expect(resetStudent(stranger.id)).rejects.toThrow(/not a demo account/);

      // Their own data survives a reset of a demo student.
      const answer = await db.orm.public.Interaction.where({ videoId: (await db.orm.public.Video.where({ fileKey: demoFileKey(MODULES[0].slug) }).first())!.id }).first();
      const option = await db.orm.public.InteractionOption.where({ interactionId: answer!.id }).first();
      await db.orm.public.InteractionResponse.create({ userId: stranger.id, interactionId: answer!.id, selectedOptionId: option!.id, isSkipped: false });
      const studentId = await makeStudent();
      await seedStudentHistory(studentId);
      await resetStudent(studentId);
      expect(await db.orm.public.InteractionResponse.where({ userId: stranger.id }).all()).toHaveLength(1);
    } finally {
      await db.orm.public.User.where({ id: stranger.id }).deleteAll();
    }
  }, 300_000);
});
