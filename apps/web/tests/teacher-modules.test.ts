import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { canPublish, moduleReadiness, validateModuleDetails } from "@/lib/teacher/modules-model";
import {
  createModule,
  getTeacherModule,
  listConvertibleVideos,
  listJourneysOverview,
  listTeacherModules,
  setModuleStatus,
  updateModuleDetails,
} from "@/lib/teacher/modules";
import { getTeacherDashboard } from "@/lib/teacher/dashboard";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("uploadthing/server", () => ({ UTApi: class { deleteFiles = async () => ({}); } }));

const details = (over: Record<string, unknown> = {}) => ({
  sourceStory: "  The Tortoise and the Hare (Aesop)  ",
  primaryVirtueId: 1,
  secondaryVirtueIds: [2, 3],
  ageBand: "8-9",
  learningObjective: "I can keep going.",
  discussionPrompts: ["  Why did Hare stop?  ", "", "What helps you keep going?"],
  followUpActivity: "Practise one thing for five minutes a day.",
  ...over,
});

// ------------------------------------------------------------------ pure

describe("module details validation (pure)", () => {
  const ids = new Set([1, 2, 3, 4]);

  it("trims text, drops empty prompts and keeps secondary order", () => {
    const r = validateModuleDetails(details(), ids);
    expect(r.errors).toBeUndefined();
    expect(r.value).toMatchObject({ sourceStory: "The Tortoise and the Hare (Aesop)", secondaryVirtueIds: [2, 3], discussionPrompts: ["Why did Hare stop?", "What helps you keep going?"] });
  });

  it("rejects a secondary equal to the primary, more than two secondaries and unknown virtues", () => {
    expect(validateModuleDetails(details({ secondaryVirtueIds: [1] }), ids).errors?.secondaryVirtueIds).toMatch(/main virtue/);
    expect(validateModuleDetails(details({ secondaryVirtueIds: [2, 3, 4] }), ids).errors?.secondaryVirtueIds).toMatch(/at most 2/);
    expect(validateModuleDetails(details({ secondaryVirtueIds: [99] }), ids).errors?.secondaryVirtueIds).toBe("Unknown virtue.");
    expect(validateModuleDetails(details({ primaryVirtueId: 99 }), ids).errors?.primaryVirtueId).toBeDefined();
  });

  it("requires the text fields and a known age band", () => {
    for (const key of ["sourceStory", "learningObjective", "followUpActivity"]) {
      expect(validateModuleDetails(details({ [key]: "   " }), ids).errors?.[key]).toBeDefined();
    }
    expect(validateModuleDetails(details({ ageBand: "13-15" }), ids).errors?.ageBand).toBeDefined();
    expect(validateModuleDetails(details({ discussionPrompts: Array(6).fill("Q?") }), ids).errors?.discussionPrompts).toBeDefined();
    for (const body of [null, [], "x"]) expect(validateModuleDetails(body, ids).errors).toBeDefined();
  });

  it("blocks publishing without questions, with typed answers or with no weights; the rest is advice", () => {
    const base = { questionCount: 4, textQuestionCount: 0, weightedQuestionCount: 4, promptCount: 2, inJourney: true };
    expect(canPublish(moduleReadiness(base))).toBe(true);
    expect(canPublish(moduleReadiness({ ...base, questionCount: 0, weightedQuestionCount: 0 }))).toBe(false);
    expect(canPublish(moduleReadiness({ ...base, textQuestionCount: 1 }))).toBe(false);
    expect(canPublish(moduleReadiness({ ...base, weightedQuestionCount: 0 }))).toBe(false);
    // Advice only: some unweighted questions, no prompts, not in a journey.
    expect(canPublish(moduleReadiness({ ...base, weightedQuestionCount: 1, promptCount: 0, inJourney: false }))).toBe(true);
  });
});

// ------------------------------------------------------------------ database

describe("teacher modules against the database", () => {
  const users: number[] = [];
  const videos: number[] = [];
  const journeys: number[] = [];
  let teacher = 0;
  let other = 0;
  let student = 0;
  let v = [0, 0, 0];

  async function makeUser(label: string, role: "STUDENT" | "TEACHER") {
    const u = await db.orm.public.User.create({ name: label, email: `${label}-${randomUUID()}@example.com`, password: "x", role });
    users.push(u.id);
    return u.id;
  }
  async function makeVideo(uploaderId: number, title: string) {
    const key = `key-${randomUUID()}`;
    const row = await db.orm.public.Video.create({
      title, fileUrl: `https://example.ufs.sh/f/${key}`, duration: 100, mimeType: "video/mp4", originalName: "v.mp4", sizeBytes: 1, fileKey: key, uploaderId,
    });
    videos.push(row.id);
    return row.id;
  }

  beforeAll(async () => {
    const vs = await db.orm.public.Virtue.orderBy((x) => x.position.asc()).all();
    v = vs.slice(0, 3).map((x) => x.id);
    teacher = await makeUser("tm-teacher", "TEACHER");
    other = await makeUser("tm-other", "TEACHER");
    student = await makeUser("tm-student", "STUDENT");
  }, 120_000);

  afterAll(async () => {
    for (const id of journeys) await db.orm.public.Journey.where({ id }).deleteAll();
    for (const id of videos) await db.orm.public.Video.where({ id }).deleteAll();
    for (const id of users) await db.orm.public.User.where({ id }).deleteAll();
  }, 120_000);

  it("creates a draft module from the teacher's own video only, once", async () => {
    const mine = await makeVideo(teacher, "Tortoise");
    const theirs = await makeVideo(other, "Not mine");
    expect((await listConvertibleVideos(teacher)).map((x) => x.id)).toContain(mine);

    await expect(createModule(teacher, theirs, details({ primaryVirtueId: v[0], secondaryVirtueIds: [v[1]] }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createModule(teacher, mine, details({ primaryVirtueId: v[0], secondaryVirtueIds: [v[0]] }))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const id = await createModule(teacher, mine, details({ primaryVirtueId: v[0], secondaryVirtueIds: [v[1]] }));
    const mod = await getTeacherModule(teacher, id);
    expect(mod).toMatchObject({ status: "DRAFT", title: "Tortoise", ageBand: "8-9", questionCount: 0 });
    expect(mod.secondary.map((x) => x.id)).toEqual([v[1]]);
    expect((await listConvertibleVideos(teacher)).map((x) => x.id)).not.toContain(mine);
    await expect(createModule(teacher, mine, details({ primaryVirtueId: v[0], secondaryVirtueIds: [] }))).rejects.toMatchObject({ code: "CONFLICT" });

    // Another teacher cannot read, edit or publish it: it looks missing.
    await expect(getTeacherModule(other, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateModuleDetails(other, id, details({ primaryVirtueId: v[0], secondaryVirtueIds: [] }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setModuleStatus(other, id, "PUBLISHED")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("swaps the primary with a former secondary without tripping the database CHECK", async () => {
    const video = await makeVideo(teacher, "Swap");
    const id = await createModule(teacher, video, details({ primaryVirtueId: v[0], secondaryVirtueIds: [v[1], v[2]] }));
    await updateModuleDetails(teacher, id, details({ primaryVirtueId: v[1], secondaryVirtueIds: [v[0]] }));
    const mod = await getTeacherModule(teacher, id);
    expect(mod.primary.id).toBe(v[1]);
    expect(mod.secondary.map((x) => x.id)).toEqual([v[0]]);
  });

  it("publishes only when ready, and counts weighted questions", async () => {
    const video = await makeVideo(teacher, "Publishable");
    const id = await createModule(teacher, video, details({ primaryVirtueId: v[0], secondaryVirtueIds: [] }));
    await expect(setModuleStatus(teacher, id, "PUBLISHED")).rejects.toMatchObject({ code: "CONFLICT" });

    const q = await db.orm.public.Interaction.create({ videoId: video, timestamp: 10, type: "SURVEY", question: "What should Tortoise do?" });
    const o = await db.orm.public.InteractionOption.create({ interactionId: q.id, text: "Keep going", position: 0 });
    await db.orm.public.InteractionOption.create({ interactionId: q.id, text: "Stop", position: 1 });
    // A question without weights is still not enough.
    await expect(setModuleStatus(teacher, id, "PUBLISHED")).rejects.toMatchObject({ code: "CONFLICT" });

    await db.orm.public.OptionVirtueWeight.create({ optionId: o.id, virtueId: v[0], weight: 2 });
    expect((await getTeacherModule(teacher, id)).weightedQuestionCount).toBe(1);
    await setModuleStatus(teacher, id, "PUBLISHED");
    expect((await getTeacherModule(teacher, id)).status).toBe("PUBLISHED");
    await setModuleStatus(teacher, id, "DRAFT");
    expect((await getTeacherModule(teacher, id)).status).toBe("DRAFT");
    await setModuleStatus(teacher, id, "PUBLISHED");

    // Progress by a student shows up in the counts and on the dashboard.
    await db.orm.public.ModuleProgress.create({ userId: student, moduleId: id, lastPositionSeconds: 90, completedAt: new Date() });
    const row = (await listTeacherModules(teacher)).find((m) => m.id === id)!;
    expect(row).toMatchObject({ startedCount: 1, completedCount: 1, questionCount: 1, weightedQuestionCount: 1 });

    const dash = await getTeacherDashboard(teacher);
    // Every teacher sees every student now, so other students may be present; this one must be.
    expect(dash.students.map((s) => s.id)).toContain(student);
    expect(dash.finishedLast30Days).toBe(1);
    expect(dash.activity[0]).toMatchObject({ studentId: student, moduleId: id, completed: true });
    expect(dash.attention.unratedStudents.map((s) => s.id)).toContain(student);
    expect(dash.coverage.find((c) => c.id === v[0])!.published).toBeGreaterThanOrEqual(1);
    // Another teacher sees the same students (shared roster) but none of this teacher's modules.
    const otherDash = await getTeacherDashboard(other);
    expect(otherDash.students.map((s) => s.id)).toContain(student);
    expect(otherDash.coverage.find((c) => c.id === v[0])!.published).toBe(0);
  });

  it("marks journey levels after a draft as unreachable", async () => {
    const a = await makeVideo(teacher, "Level one draft");
    const b = await makeVideo(teacher, "Level two");
    const ma = await createModule(teacher, a, details({ primaryVirtueId: v[0], secondaryVirtueIds: [] }));
    const mb = await createModule(teacher, b, details({ primaryVirtueId: v[1], secondaryVirtueIds: [] }));
    const j = await db.orm.public.Journey.create({ title: `Test journey ${randomUUID()}`, description: "Test", displayOrder: 999 });
    journeys.push(j.id);
    await db.orm.public.JourneyModule.createAll([
      { journeyId: j.id, moduleId: ma, level: 1, position: 0 },
      { journeyId: j.id, moduleId: mb, level: 2, position: 0 },
    ]);
    const overview = (await listJourneysOverview(teacher)).find((x) => x.id === j.id)!;
    expect(overview.levels.map((l) => l.level)).toEqual([1, 2]);
    expect(overview.blockedLevels).toEqual([2]);
    expect(overview.levels[0].modules[0]).toMatchObject({ moduleId: ma, mine: true, status: "DRAFT" });
    // Another teacher sees the journey but cannot open the module.
    const theirs = (await listJourneysOverview(other)).find((x) => x.id === j.id)!;
    expect(theirs.levels[0].modules[0].mine).toBe(false);
    expect((await getTeacherModule(teacher, ma)).placements).toEqual([{ journeyId: j.id, journeyTitle: overview.title, level: 1 }]);
  });
});
