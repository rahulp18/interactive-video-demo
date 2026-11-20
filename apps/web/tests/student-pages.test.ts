import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PUT as avatarRoute } from "@/app/api/student/profile/avatar/route";
import { AuthError } from "@/lib/auth/errors";
import { parseId } from "@/lib/api/route";
import { canAccessPath } from "@/lib/auth/roles";
import { createSession } from "@/lib/auth/session";
import {
  childBadgeTitle,
  hasBlossom,
  leavesFor,
  MAX_LEAVES,
  moduleStatus,
  pickUpNext,
  sourceLine,
  TREE_STAGE_STARS,
  treeStage,
  watchedFraction,
  youWillLearn,
} from "@/lib/learning/overview-rules";
import { getStudentJourneys, getStudentModulePage, getStudentOverview, getStudentProfile, getVirtueTree } from "@/lib/learning/overview";
import { setAvatar } from "@/lib/learning/profile";
import { unlockedModuleIds } from "@/lib/learning/rules";
import { AVATARS, AVATAR_KEYS, isAvatarKey } from "@/lib/student/avatars";
import { VIRTUE_DISPLAY, VIRTUE_SLUGS } from "@/lib/virtues/display";
import { db } from "@/prisma/db";
import { MODULES } from "@/scripts/demo/content";
import { JOURNEYS } from "@/scripts/demo/content";
import { ensureAccounts, resetStudent, seedContent, seedJourneys } from "@/scripts/demo/seed-lib";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("uploadthing/server", () => ({ UTApi: class { deleteFiles = async () => ({}); } }));

// Lets one test steer the engine's "next step" virtues, to prove they influence (and never leak from) "Up next".
const engine = vi.hoisted(() => ({ forcedFocus: null as number[] | null }));
vi.mock("@/lib/scoring/engine", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/scoring/engine")>();
  return {
    ...real,
    buildAssessment: (...args: Parameters<typeof real.buildAssessment>) => {
      const assessment = real.buildAssessment(...args);
      return engine.forcedFocus ? { ...assessment, nextStepVirtueIds: engine.forcedFocus } : assessment;
    },
  };
});

const ORIGIN = "http://localhost:3000";
// Keys a child-facing payload must never contain.
const FORBIDDEN_KEY = /score|composite|confidence|trend|swot|weak|threat|discussion|nextstep|iscorrect|weight|rank|percent/i;

function allKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, into));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      allKeys(v, into);
    }
  return into;
}

// ------------------------------------------------------------------ pure rules

describe("student page rules (pure)", () => {
  const cand = (moduleId: number, primaryVirtueId: number, journeyOrder: number, level = 1, position = 0) => ({ moduleId, primaryVirtueId, journeyOrder, level, position });

  it("up next prefers a focus virtue, then journey order", () => {
    const list = [cand(1, 10, 0), cand(2, 20, 1), cand(3, 30, 2)];
    expect(pickUpNext(list, [])).toBe(1); // nothing to prefer: journey order
    expect(pickUpNext(list, [30])).toBe(3);
    expect(pickUpNext(list, [20, 30])).toBe(2); // earlier focus virtue wins
    expect(pickUpNext(list, [99])).toBe(1);
    expect(pickUpNext([], [1])).toBeNull();
    expect(pickUpNext([cand(5, 1, 0, 2, 0), cand(4, 1, 0, 1, 1), cand(3, 1, 0, 1, 0)], [])).toBe(3);
  });

  it("statuses follow the unlock rule", () => {
    const placements = [
      { journeyId: 1, moduleId: 1, level: 1, position: 0 },
      { journeyId: 1, moduleId: 2, level: 2, position: 0 },
    ];
    expect(moduleStatus(1, placements, new Set(), new Set())).toBe("ready");
    expect(moduleStatus(1, placements, new Set(), new Set([1]))).toBe("in-progress");
    expect(moduleStatus(2, placements, new Set(), new Set())).toBe("locked");
    expect(moduleStatus(2, placements, new Set([1]), new Set())).toBe("ready");
    expect(moduleStatus(1, placements, new Set([1]), new Set([1]))).toBe("completed");
  });

  it("the tree grows with total stars and every branch shows something", () => {
    const { young, full } = TREE_STAGE_STARS;
    expect([0, young - 1, young, full - 1, full, 99].map(treeStage)).toEqual(["sapling", "sapling", "young", "young", "full", "full"]);
    expect(leavesFor(0)).toBe(0);
    expect(leavesFor(2.9)).toBe(2);
    expect(leavesFor(500)).toBe(MAX_LEAVES);
    expect(hasBlossom(0)).toBe(false);
    expect(hasBlossom(5)).toBe(true);
  });

  it("watch progress is a clamped fraction", () => {
    expect(watchedFraction(0, 100)).toBe(0);
    expect(watchedFraction(40, 100)).toBe(0.4);
    expect(watchedFraction(500, 100)).toBe(1);
    expect(watchedFraction(10, 0)).toBe(0);
  });

  it("rewrites the learning objective for a child and never leaves the first person", () => {
    for (const m of MODULES) {
      const line = youWillLearn(m.learningObjective);
      expect(line, m.slug).toMatch(/^[A-Z].*\.$/);
      expect(line, m.slug).not.toMatch(/\b(I|my|me)\b/);
    }
    expect(youWillLearn("I can keep going, even when it is hard.")).toBe("You can keep going, even when it is hard.");
  });

  it("names the source collection for every demo story", () => {
    for (const m of MODULES) expect(sourceLine(m.sourceStory), m.slug).toMatch(/^An? (story from .+|.*folk tale)$/);
    expect(sourceLine("The Tortoise and the Hare (Aesop's Fables)")).toBe("A story from Aesop's Fables");
    expect(sourceLine("No source")).toBe("A story to enjoy");
  });

  it("rewords badge titles for children", () => {
    const stories = new Map([[7, "The Brave Little Parrot"]]);
    const names = new Map([[2, "Compassion"]]);
    expect(childBadgeTitle({ id: "module:7", kind: "module", title: "Story finished", virtueId: null }, stories, names)).toBe("Finished: The Brave Little Parrot");
    expect(childBadgeTitle({ id: "journey-level:1:2", kind: "journey-level", title: "Honesty Trail: level 2 complete", virtueId: null }, stories, names)).toBe("Honesty Trail, level 2 done!");
    expect(childBadgeTitle({ id: "virtue:2:6", kind: "virtue", title: "Compassion star 6", virtueId: 2 }, stories, names)).toBe("Compassion: 6 stars!");
  });
});

describe("virtue identity and avatars (pure)", () => {
  it("every virtue has an icon, colour, name and lines, and colours are distinct", () => {
    expect(Object.keys(VIRTUE_DISPLAY)).toEqual([...VIRTUE_SLUGS]);
    const colours = new Set<string>();
    for (const slug of VIRTUE_SLUGS) {
      const v = VIRTUE_DISPLAY[slug];
      expect(v.icon).toBeTruthy();
      expect(v.name.length).toBeGreaterThan(2);
      expect(v.line.length).toBeGreaterThan(5);
      expect(v.explain.length).toBeGreaterThan(20);
      expect(v.color).toMatch(/^#[0-9A-F]{6}$/i);
      colours.add(v.color.toLowerCase());
    }
    expect(colours.size).toBe(VIRTUE_SLUGS.length);
  });

  it("virtue wording is child-safe", () => {
    for (const v of Object.values(VIRTUE_DISPLAY)) expect(`${v.line} ${v.explain}`).not.toMatch(/weak|score|bad|poor|wrong|lowest/i);
  });

  it("presets are valid for the database format check and unique", () => {
    expect(AVATARS.length).toBeGreaterThanOrEqual(8);
    expect(AVATARS.length).toBeLessThanOrEqual(12);
    expect(new Set(AVATAR_KEYS).size).toBe(AVATARS.length);
    for (const key of AVATAR_KEYS) expect(key).toMatch(/^[a-z]{3,20}$/);
    expect(isAvatarKey("fox")).toBe(true);
    expect(isAvatarKey("dragon")).toBe(false);
    expect(isAvatarKey("../etc")).toBe(false);
    expect(isAvatarKey(5)).toBe(false);
  });

  it("only students may open student pages", () => {
    for (const path of ["/student", "/student/journeys", "/student/journeys/1", "/student/modules/1", "/student/virtues", "/student/profile"]) {
      expect(canAccessPath("STUDENT", path), path).toBe(true);
      expect(canAccessPath("TEACHER", path), path).toBe(false);
    }
  });

  it("an unreadable id is a not-found, not a crash", () => {
    for (const bad of ["abc", "-1", "0", "1e3", "99999999999", ""]) expect(() => parseId(bad, "Story")).toThrow(AuthError);
  });
});

// ------------------------------------------------------------------ database

describe("student pages against the database", () => {
  const throwaway: number[] = [];
  const videos: number[] = [];
  let ownerId = 0;
  let aaravId = 0;
  let fresh = { id: 0, token: "" };
  let teacher = { id: 0, token: "" };
  let virtueIdBySlug = new Map<string, number>();
  const password = process.env["DEMO_PASSWORD"] && process.env["DEMO_PASSWORD"]!.length >= 8 ? process.env["DEMO_PASSWORD"]! : randomUUID();

  async function makeUser(label: string, role: "STUDENT" | "TEACHER") {
    const u = await db.orm.public.User.create({ name: label, email: `${label}-${randomUUID()}@example.com`, password: "x", role });
    throwaway.push(u.id);
    return { id: u.id, token: (await createSession(u.id)).token };
  }

  const moduleIdOf = new Map<string, number>();
  const idOf = (slug: string) => moduleIdOf.get(slug)!;

  beforeAll(async () => {
    virtueIdBySlug = new Map((await db.orm.public.Virtue.all()).map((v) => [v.slug, v.id]));
    const ids = await ensureAccounts(password);
    ownerId = ids.content;
    aaravId = ids.student;
    const content = await seedContent(ownerId);
    await seedJourneys(content.moduleIds);
    for (const [slug, id] of Object.entries(content.moduleIds)) moduleIdOf.set(slug, id);
    await resetStudent(aaravId);
    fresh = await makeUser("pages-fresh", "STUDENT");
    teacher = await makeUser("pages-teacher", "TEACHER");
  }, 300_000);

  afterAll(async () => {
    engine.forcedFocus = null;
    for (const id of videos) await db.orm.public.Video.where({ id }).deleteAll();
    for (const id of throwaway) await db.orm.public.User.where({ id }).deleteAll();
    await resetStudent(aaravId); // leave the demo student in the designed state
  }, 120_000);

  const modulesOf = (journeys: Awaited<ReturnType<typeof getStudentJourneys>>["journeys"]) => journeys.flatMap((j) => j.levels.flatMap((l) => l.modules));

  it("the demo student's statuses match the seeded history", async () => {
    const { journeys } = await getStudentJourneys(aaravId);
    expect(journeys.map((j) => j.title)).toEqual(JOURNEYS.map((j) => j.title));
    const status = (slug: string) => modulesOf(journeys).find((m) => m.moduleId === idOf(slug))!.status;
    expect(status("little-mango-seed")).toBe("in-progress");
    expect(status("brave-little-parrot")).toBe("ready");
    for (const slug of ["tortoise-and-the-hare", "ant-and-the-grasshopper", "injured-swan", "honest-woodcutter", "pigeons-and-the-net", "dog-and-the-reflection"]) expect(status(slug), slug).toBe("completed");
    const mango = modulesOf(journeys).find((m) => m.moduleId === idOf("little-mango-seed"))!;
    expect(mango.watchedFraction).toBeGreaterThan(0);
    expect(mango.watchedFraction).toBeLessThan(1);
  });

  it("locking matches the unlock rule exactly", async () => {
    const { journeys } = await getStudentJourneys(fresh.id);
    const placements = (await db.orm.public.JourneyModule.all()).map((p) => ({ journeyId: p.journeyId, moduleId: p.moduleId, level: p.level, position: p.position }));
    const open = unlockedModuleIds(placements, new Set());
    for (const m of modulesOf(journeys)) expect(m.status === "locked", m.title).toBe(!open.has(m.moduleId));
    // Level 2 of every journey is locked and says so.
    for (const j of journeys) {
      expect(j.levels[0].open).toBe(true);
      expect(j.levels[1].open).toBe(false);
    }
  });

  it("Home for the demo student says Continue, with the in-progress story", async () => {
    const overview = await getStudentOverview(aaravId);
    expect(overview.continue).toMatchObject({ moduleId: idOf("little-mango-seed"), title: "The Little Mango Seed" });
    expect(overview.continue!.watchedFraction).toBeGreaterThan(0);
    expect(overview.upNext).toBeNull();
    expect(overview.student.name).toBe("Aarav");
    expect(isAvatarKey(overview.student.avatar)).toBe(true);
    expect(overview.storiesFinished).toBe(8);
    expect(overview.totalStars).toBeGreaterThan(0);
    expect(overview.newestBadge).not.toBeNull();
    expect(overview.journeys.map((j) => `${j.storiesDone}/${j.storiesTotal}`)).toEqual(["3/4", "3/3", "2/3"]);
  });

  it("Home for a fresh student: level-1 ready, everything else locked, up next is the first story", async () => {
    const overview = await getStudentOverview(fresh.id);
    expect(overview.continue).toBeNull();
    expect(overview.storiesFinished).toBe(0);
    expect(overview.totalStars).toBe(0);
    expect(overview.treeStage).toBe("sapling");
    const first = JOURNEYS[0].levels[0][0];
    expect(overview.upNext?.moduleId).toBe(idOf(first));
    for (const j of overview.journeys) {
      j.levels.forEach((level, i) =>
        level.modules.forEach((m) => expect(m.status, `${j.title} level ${level.level}`).toBe(i === 0 ? "ready" : "locked")),
      );
    }
    // Every branch still shows something growing: all ten exist, in order.
    expect(overview.branches.map((b) => b.slug)).toEqual([...VIRTUE_SLUGS]);
  });

  it("up next may be steered by the engine, and the result never shows how", async () => {
    const compassion = virtueIdBySlug.get("compassion")!;
    try {
      engine.forcedFocus = [compassion];
      const steered = await getStudentOverview(fresh.id);
      expect(steered.upNext?.moduleId).toBe(idOf("injured-swan")); // compassion story, not the first in journey order
      engine.forcedFocus = [];
      const plain = await getStudentOverview(fresh.id);
      expect(plain.upNext?.moduleId).toBe(idOf(JOURNEYS[0].levels[0][0]));
      const json = JSON.stringify(steered);
      expect(json).not.toMatch(/nextStep|reason|because/i); // (a journey's own "focusVirtue" is content, not the engine's pick)
      expect(json).not.toContain(`"id":${compassion},`);
    } finally {
      engine.forcedFocus = null;
    }
  });

  // NOTE: lib/reports/getParentReport (the Phase 6 parent preview) is deliberately NOT in this list. It exists to show
  // scores, weaknesses and discussion prompts to an adult behind the parental gate. tests/parent-report.test.ts proves
  // that no child-facing file imports it.
  it("every child-facing loader is free of scores, weaknesses and discussion prompts", async () => {
    const prompts = MODULES.flatMap((m) => m.discussionPrompts);
    for (const userId of [aaravId, fresh.id]) {
      const payloads: unknown[] = [
        await getStudentOverview(userId),
        await getStudentJourneys(userId),
        await getVirtueTree(userId),
        await getStudentProfile(userId),
        ...(await Promise.all(MODULES.map((m) => getStudentModulePage(userId, idOf(m.slug))))),
      ];
      for (const payload of payloads) {
        const keys = [...allKeys(payload)];
        expect(keys.filter((k) => FORBIDDEN_KEY.test(k))).toEqual([]);
        const json = JSON.stringify(payload);
        for (const prompt of prompts) expect(json).not.toContain(prompt);
        expect(json).not.toMatch(/weak|threat|swot|lowest|confidence/i);
      }
    }
  });

  it("virtues keep their fixed order whatever the stars are", async () => {
    for (const userId of [aaravId, fresh.id]) {
      const tree = await getVirtueTree(userId);
      expect(tree.branches.map((b) => b.slug)).toEqual([...VIRTUE_SLUGS]);
      expect((await getStudentOverview(userId)).branches.map((b) => b.slug)).toEqual([...VIRTUE_SLUGS]);
    }
    const aarav = await getVirtueTree(aaravId);
    const stars = aarav.branches.map((b) => b.stars);
    expect(new Set(stars).size).toBeGreaterThan(1); // the stars differ, yet the order did not follow them
    expect(stars).not.toEqual([...stars].sort((a, b) => b - a));
    expect(aarav.stage).toBe(treeStage(aarav.totalStars));
    expect(aarav.superpowers.length).toBeGreaterThan(0);
    expect(aarav.badges.length).toBeGreaterThan(0);
    for (const b of aarav.badges) expect(b.title).not.toMatch(/^Story finished$/);
  });

  it("the module page: ready, in progress, completed, locked and missing", async () => {
    const ready = await getStudentModulePage(aaravId, idOf("brave-little-parrot"));
    expect(ready).toMatchObject({ status: "ok", moduleStatus: "ready", followUpActivity: null });
    if (ready.status === "ok") {
      expect(ready.sourceLine).toMatch(/Jataka/);
      expect(ready.virtues[0]).toBe("courage");
      expect(ready.youWillLearn).toMatch(/^You can/);
    }

    const going = await getStudentModulePage(aaravId, idOf("little-mango-seed"));
    expect(going).toMatchObject({ status: "ok", moduleStatus: "in-progress", followUpActivity: null });

    const done = await getStudentModulePage(aaravId, idOf("tortoise-and-the-hare"));
    const tortoise = MODULES.find((m) => m.slug === "tortoise-and-the-hare")!;
    expect(done).toMatchObject({ status: "ok", moduleStatus: "completed", followUpActivity: tortoise.followUp });

    const locked = await getStudentModulePage(fresh.id, idOf("brave-little-parrot"));
    expect(locked.status).toBe("locked");
    if (locked.status === "locked") expect(locked.unlockHint).toMatch(/Level 1 of Perseverance Path/);
    expect(JSON.stringify(locked)).not.toContain(tortoise.followUp);

    expect(await getStudentModulePage(aaravId, 2_000_000_000)).toEqual({ status: "missing" });
  });

  it("an unpublished module is not found", async () => {
    const key = `key-${randomUUID()}`;
    const video = await db.orm.public.Video.create({ title: "Draft story", fileUrl: `https://example.ufs.sh/f/${key}`, duration: 60, mimeType: "video/mp4", originalName: "v.mp4", sizeBytes: 1, fileKey: key, uploaderId: ownerId });
    videos.push(video.id);
    const mod = await db.orm.public.Module.create({
      videoId: video.id, sourceStory: "Draft (Test)", primaryVirtueId: virtueIdBySlug.get("honesty")!, ageBand: "8-9", learningObjective: "I can test.", discussionPrompts: [], followUpActivity: "Test.", status: "DRAFT",
    });
    expect(await getStudentModulePage(aaravId, mod.id)).toEqual({ status: "missing" });
  });

  describe("avatar", () => {
    const put = (token: string | null, body: unknown) =>
      avatarRoute(new Request(`${ORIGIN}/api/student/profile/avatar`, { method: "PUT", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
    const stored = async (id: number) => (await db.orm.public.User.where({ id }).first())!.avatar;

    it("saves a valid key and shows it in the loaders", async () => {
      const res = await put(fresh.token, { avatar: "owl" });
      expect(res.status).toBe(200);
      expect(await stored(fresh.id)).toBe("owl");
      expect((await getStudentOverview(fresh.id)).student.avatar).toBe("owl");
      expect((await getStudentProfile(fresh.id)).avatar).toBe("owl");
    });

    it("rejects keys that are not presets", async () => {
      for (const bad of ["dragon", "FOX", "", "fox ", "../x", 5, null, undefined]) {
        const res = await put(fresh.token, { avatar: bad });
        expect(res.status, String(bad)).toBe(400);
      }
      expect(await put(fresh.token, {}).then((r) => r.status)).toBe(400);
      expect(await stored(fresh.id)).toBe("owl");
      await expect(setAvatar(fresh.id, { avatar: "dragon" })).rejects.toThrow(AuthError);
    });

    it("the database refuses a malformed key even when the app is bypassed", async () => {
      for (const bad of ["Fox", "a", "x".repeat(21), "fox1", "https://x.test/a.png", "fox bear"]) {
        await expect(db.orm.public.User.where({ id: fresh.id }).updateAll({ avatar: bad }), bad).rejects.toThrow();
      }
      expect(await stored(fresh.id)).toBe("owl");
    });

    it("a teacher or a signed-out caller cannot use the endpoint", async () => {
      expect((await put(teacher.token, { avatar: "fox" })).status).toBe(403);
      expect((await put(null, { avatar: "fox" })).status).toBe(401);
      expect(await stored(teacher.id)).toBeNull();
    });

    it("another website cannot change it", async () => {
      const res = await avatarRoute(
        new Request(`${ORIGIN}/api/student/profile/avatar`, { method: "PUT", headers: { "content-type": "application/json", origin: "https://evil.example", authorization: `Bearer ${fresh.token}` }, body: JSON.stringify({ avatar: "fox" }) }),
      );
      expect(res.status).toBe(403);
      expect(await stored(fresh.id)).toBe("owl");
    });
  });

  it("the profile shows only counts", async () => {
    const profile = await getStudentProfile(aaravId);
    expect(profile).toMatchObject({ name: "Aarav", username: "aarav", storiesFinished: 8 });
    expect(Object.keys(profile).sort()).toEqual(["avatar", "badgeCount", "name", "storiesFinished", "totalStars", "username"]);
  });

  it("demo:reset keeps the avatar", async () => {
    const before = (await db.orm.public.User.where({ id: aaravId }).first())!.avatar;
    await resetStudent(aaravId);
    expect((await db.orm.public.User.where({ id: aaravId }).first())!.avatar).toBe(before);
  });
});
