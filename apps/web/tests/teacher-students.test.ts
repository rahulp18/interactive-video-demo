import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { canAccessPath } from "@/lib/auth/roles";
import { getAssessment } from "@/lib/scoring/service";
import { TEACHER_NOTES_MAX, validateTeacherRatings } from "@/lib/teacher/ratings-model";
import {
  assertStudentExists,
  createStudentAccount,
  getTeacherStudentDetail,
  listTeacherStudents,
  openTeacherReport,
  recordTeacherReportPrint,
  saveTeacherRatings,
} from "@/lib/teacher/students";
import { verifyPassword } from "@/lib/auth/password";
import { loginWithPin } from "@/lib/auth/pin";
import { db } from "@/prisma/db";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("uploadthing/server", () => ({ UTApi: class { deleteFiles = async () => ({}); } }));

// ------------------------------------------------------------------ pure

describe("teacher ratings validation (pure)", () => {
  const ids = [1, 2, 3];

  it("keeps only rated virtues, sorted, and trims notes", () => {
    const r = validateTeacherRatings({ ratings: { "3": 5, "1": 2, "2": null }, notes: "  Kind to others.  " }, ids);
    expect(r.errors).toBeUndefined();
    expect(r.value).toEqual({ ratings: [{ virtueId: 1, rating: 2 }, { virtueId: 3, rating: 5 }], notes: "Kind to others." });
    expect(validateTeacherRatings({ ratings: { "1": 4 }, notes: "   " }, ids).value?.notes).toBeNull();
  });

  it("needs at least one rating", () => {
    expect(validateTeacherRatings({ ratings: {} }, ids).errors?.ratings).toMatch(/at least one/);
    expect(validateTeacherRatings({ ratings: { "1": null, "2": null } }, ids).errors?.ratings).toMatch(/at least one/);
  });

  it("rejects out-of-range, non-integer and unknown-virtue ratings, bad notes and bad shapes", () => {
    for (const bad of [0, 6, 2.5, "3", true, -1]) {
      expect(validateTeacherRatings({ ratings: { "1": bad } }, ids).errors?.["ratings.1"]).toBeDefined();
    }
    expect(validateTeacherRatings({ ratings: { "99": 3 } }, ids).errors?.["ratings.99"]).toBe("Unknown virtue.");
    expect(validateTeacherRatings({ ratings: { abc: 3 } }, ids).errors?.["ratings.abc"]).toBe("Unknown virtue.");
    expect(validateTeacherRatings({ ratings: { "1": 3 }, notes: "x".repeat(TEACHER_NOTES_MAX + 1) }, ids).errors?.notes).toBeDefined();
    expect(validateTeacherRatings({ ratings: { "1": 3 }, notes: 7 }, ids).errors?.notes).toBeDefined();
    for (const body of [null, [], "x", { ratings: [] }, { ratings: null }]) expect(validateTeacherRatings(body, ids).errors).toBeDefined();
  });

  it("students and their reports are teacher-only routes", () => {
    for (const path of ["/students", "/students/12"]) {
      expect(canAccessPath("TEACHER", path)).toBe(true);
      expect(canAccessPath("STUDENT", path)).toBe(false);
    }
  });
});

// ------------------------------------------------------------------ database

describe("teacher students against the database", () => {
  const users: number[] = [];
  const videos: number[] = [];
  let teacherA = { id: 0, name: "Ms A Teacher" };
  let teacherB = { id: 0, name: "Mr B Teacher" };
  let viaProgress = 0; // started teacher A's module
  let viaAnswer = 0; // answered a question on teacher A's plain video
  let onlyB = 0; // used teacher B's content only
  let idle = 0; // a student with no activity at all
  let virtueId = 0;

  async function makeUser(label: string, role: "STUDENT" | "TEACHER") {
    const u = await db.orm.public.User.create({ name: label, email: `${label}-${randomUUID()}@example.com`, password: "x", role });
    users.push(u.id);
    return u.id;
  }
  async function makeVideo(uploaderId: number, title: string) {
    const key = `key-${randomUUID()}`;
    const v = await db.orm.public.Video.create({
      title, fileUrl: `https://example.ufs.sh/f/${key}`, duration: 100, mimeType: "video/mp4", originalName: "v.mp4", sizeBytes: 1, fileKey: key, uploaderId,
    });
    videos.push(v.id);
    return v.id;
  }
  async function makeQuestion(videoId: number) {
    const i = await db.orm.public.Interaction.create({ videoId, timestamp: 10, type: "SURVEY", question: "How do you feel?" });
    const o = await db.orm.public.InteractionOption.create({ interactionId: i.id, text: "Happy", position: 0 });
    return { interactionId: i.id, optionId: o.id };
  }

  beforeAll(async () => {
    teacherA = { id: await makeUser("ts-teacher-a", "TEACHER"), name: "ts-teacher-a" };
    teacherB = { id: await makeUser("ts-teacher-b", "TEACHER"), name: "ts-teacher-b" };
    viaProgress = await makeUser("ts-progress", "STUDENT");
    viaAnswer = await makeUser("ts-answer", "STUDENT");
    onlyB = await makeUser("ts-only-b", "STUDENT");
    idle = await makeUser("ts-idle", "STUDENT");
    virtueId = (await db.orm.public.Virtue.where({ position: 1 }).first())!.id;

    const storyA = await makeVideo(teacherA.id, "Story A");
    const mod = await db.orm.public.Module.create({
      videoId: storyA, sourceStory: "Story (Test)", primaryVirtueId: virtueId, ageBand: "8-9", learningObjective: "Learn.", discussionPrompts: [], followUpActivity: "Try it.", status: "PUBLISHED",
    });
    await db.orm.public.ModuleProgress.create({ userId: viaProgress, moduleId: mod.id, lastPositionSeconds: 20 });

    const plainA = await makeVideo(teacherA.id, "Plain A");
    const qa = await makeQuestion(plainA);
    await db.orm.public.InteractionResponse.create({ userId: viaAnswer, interactionId: qa.interactionId, selectedOptionId: qa.optionId, isSkipped: false });

    const plainB = await makeVideo(teacherB.id, "Plain B");
    const qb = await makeQuestion(plainB);
    await db.orm.public.InteractionResponse.create({ userId: onlyB, interactionId: qb.interactionId, selectedOptionId: qb.optionId, isSkipped: false });
    // A teacher answering a question must never make them "a student".
    await db.orm.public.InteractionResponse.create({ userId: teacherB.id, interactionId: qa.interactionId, selectedOptionId: qa.optionId, isSkipped: false });
  }, 120_000);

  afterAll(async () => {
    for (const id of videos) await db.orm.public.Video.where({ id }).deleteAll();
    for (const id of users) await db.orm.public.User.where({ id }).deleteAll();
  }, 120_000);

  it("lists every student, including ones with no activity, and never a teacher", async () => {
    const ids = (await listTeacherStudents()).map((r) => r.id);
    for (const id of [viaProgress, viaAnswer, onlyB, idle]) expect(ids).toContain(id);
    expect(ids).not.toContain(teacherA.id);
    expect(ids).not.toContain(teacherB.id);

    const rows = await listTeacherStudents();
    expect(rows.find((s) => s.id === viaProgress)).toMatchObject({ storiesStarted: 1, storiesCompleted: 0, lastTeacherRating: null });
    expect(rows.find((s) => s.id === viaProgress)!.lastActive).toBeInstanceOf(Date);
    expect(rows.find((s) => s.id === idle)).toMatchObject({ storiesStarted: 0, lastActive: null });
  });

  it("any teacher can open any student, but a teacher id and an unknown id are NOT_FOUND alike", async () => {
    for (const id of [viaProgress, viaAnswer, onlyB, idle]) await expect(assertStudentExists(id)).resolves.toBeUndefined();
    for (const id of [teacherB.id, 2_000_000_000]) {
      await expect(assertStudentExists(id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(getTeacherStudentDetail(id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(saveTeacherRatings(teacherA, id, { ratings: { [virtueId]: 4 } })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(openTeacherReport(teacherA.id, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    // Nothing was logged about an id that is not a student.
    expect(await db.orm.public.AuditLog.where({ subjectId: teacherB.id }).all()).toHaveLength(0);
  });

  it("a teacher creates a student who signs in with username + PIN (no email, no usable password)", async () => {
    const username = `ts_${randomUUID().slice(0, 8).replace(/-/g, "")}`;
    const made = await createStudentAccount({ name: "  Little   Learner ", username: username.toUpperCase(), pin: "4821" });
    users.push(made.id);
    expect(made).toMatchObject({ name: "Little Learner", username });

    const row = (await db.orm.public.User.where({ id: made.id }).first())!;
    expect(row).toMatchObject({ role: "STUDENT", username, email: `${username}@students.parichay.invalid` });
    expect(row.pinHash).toMatch(/^scrypt\$/);
    expect(row.pinHash).not.toContain("4821");
    expect(await verifyPassword("4821", row.password)).toBe(false); // the password is random, the PIN is not it

    const { user } = await loginWithPin({ username, pin: "4821" });
    expect(user).toMatchObject({ id: made.id, role: "STUDENT" });
    expect((await listTeacherStudents()).map((s) => s.id)).toContain(made.id);
  });

  it("rejects a bad name, username or PIN with field errors, and a taken username with CONFLICT", async () => {
    const bad = await createStudentAccount({ name: " ", username: "A B", pin: "12" }).catch((e) => e);
    expect(bad).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(Object.keys(bad.fields).sort()).toEqual(["name", "pin", "username"]);
    await expect(createStudentAccount({ name: "X", username: "okname", pin: "12a4" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const username = `dup_${randomUUID().slice(0, 8).replace(/-/g, "")}`;
    const first = await createStudentAccount({ name: "First", username, pin: "1111" });
    users.push(first.id);
    await expect(createStudentAccount({ name: "Second", username, pin: "2222" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("shows the student's progress on the teacher's modules", async () => {
    const detail = await getTeacherStudentDetail(viaProgress);
    expect(detail.stories.find((st) => st.title === "Story A")).toMatchObject({ status: "in-progress", published: true, completedAt: null });
    expect(detail.virtues).toHaveLength(10);
    expect(detail.latestTeacherRatings).toBeNull();
  });

  it("saving a rating set appends TEACHER rows that feed the teacher score", async () => {
    const before = (await getAssessment(viaProgress)).virtues.find((v) => v.virtueId === virtueId)!;
    expect(before.teacherScore).toBeNull();

    await expect(saveTeacherRatings(teacherA, viaProgress, { ratings: { [virtueId]: 9 } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const { saved } = await saveTeacherRatings(teacherA, viaProgress, { ratings: { [virtueId]: 5 }, notes: "Helps classmates." });
    expect(saved).toBe(1);

    const rows = await db.orm.public.VirtueRating.where({ studentId: viaProgress }).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ raterKind: "TEACHER", raterName: teacherA.name, rating: 5, mark: "NONE", notes: "Helps classmates.", virtueId });

    const after = (await getAssessment(viaProgress)).virtues.find((v) => v.virtueId === virtueId)!;
    expect(after.teacherScore).toBe(100);

    // A second set keeps the history; the newest rating is the one that counts.
    await new Promise((r) => setTimeout(r, 5));
    await saveTeacherRatings(teacherA, viaProgress, { ratings: { [virtueId]: 3 } });
    expect(await db.orm.public.VirtueRating.where({ studentId: viaProgress }).all()).toHaveLength(2);
    expect((await getAssessment(viaProgress)).virtues.find((v) => v.virtueId === virtueId)!.teacherScore).toBe(50);
    const detail = await getTeacherStudentDetail(viaProgress);
    expect(detail.latestTeacherRatings).toMatchObject({ ratings: { [virtueId]: 3 }, raterName: teacherA.name });
    expect((await listTeacherStudents()).find((s) => s.id === viaProgress)!.lastTeacherRating?.raterName).toBe(teacherA.name);
  });

  it("opening the report logs REPORT_VIEW with the teacher as actor, and printing logs REPORT_PRINT", async () => {
    const { report, access } = await openTeacherReport(teacherA.id, viaProgress);
    expect(report.virtues).toHaveLength(10);
    expect(access[0]).toMatchObject({ action: "REPORT_VIEW", actorName: teacherA.name });
    const logged = await db.orm.public.AuditLog.where({ subjectId: viaProgress }).all();
    expect(logged).toEqual([expect.objectContaining({ actorId: teacherA.id, subjectId: viaProgress, action: "REPORT_VIEW" })]);

    await recordTeacherReportPrint(teacherA.id, viaProgress);
    const actions = (await db.orm.public.AuditLog.where({ subjectId: viaProgress }).all()).map((l) => l.action).sort();
    expect(actions).toEqual(["REPORT_PRINT", "REPORT_VIEW"]);
  });
});
