import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/prisma/db";
import { AuthError } from "@/lib/auth/errors";
import { hashPassword } from "@/lib/auth/password";
import { isUniqueViolation } from "@/lib/auth/service";
import { PIN_PATTERN, USERNAME_PATTERN, normalizeUsername } from "@/lib/auth/validation";
import { logReportAccess, recentReportAccess } from "@/lib/reports/audit";
import { getParentReport } from "@/lib/reports/service";
import type { AuditEntry, ParentReport } from "@/lib/reports/types";
import { validateTeacherRatings } from "./ratings-model";

// Teacher-facing student data. There is no class model: every TEACHER can see every STUDENT (and their report), whether or
// not the child has started anything yet. A non-student id (a teacher, an unknown id) is NOT_FOUND. Students are created
// by teachers (createStudentAccount); public sign-up is closed. Nothing here is cached; adult-facing (scores via the report).

export type StudentStatus = "not-started" | "in-progress" | "completed";

export type TeacherStudentRow = {
  id: number;
  name: string;
  username: string | null;
  /** Shown only when there is no username (students who signed up with email). */
  email: string | null;
  avatar: string | null;
  storiesCompleted: number;
  storiesStarted: number;
  lastActive: Date | null;
  /** Latest TEACHER rating of this student (by anyone: raters have no accounts), or null. */
  lastTeacherRating: { at: Date; raterName: string } | null;
};

export type TeacherStudentStory = {
  moduleId: number;
  title: string;
  primaryVirtueSlug: string;
  published: boolean;
  status: StudentStatus;
  completedAt: Date | null;
  lastActive: Date | null;
};

export type TeacherRatingSet = {
  /** virtueId -> latest teacher rating for that virtue (what the engine uses). */
  ratings: Record<number, number>;
  at: Date;
  raterName: string;
  notes: string | null;
};

export type TeacherStudentDetail = {
  student: Omit<TeacherStudentRow, "lastTeacherRating">;
  stories: TeacherStudentStory[];
  virtues: { id: number; slug: string; name: string }[];
  latestTeacherRatings: TeacherRatingSet | null;
};

type Scope = { videoIds: number[]; titleOf: Map<number, string>; modules: { id: number; videoId: number; primaryVirtueId: number; status: string }[]; interactionIds: number[] };

/** All videos, the modules on them and the questions on them (teachers share one content library). */
async function contentScope(): Promise<Scope> {
  const [videos, modules, interactions] = await Promise.all([
    db.orm.public.Video.all(),
    db.orm.public.Module.all(),
    db.orm.public.Interaction.all(),
  ]);
  return {
    videoIds: videos.map((v) => v.id),
    titleOf: new Map(videos.map((v) => [v.id, v.title])),
    modules: modules.map((m) => ({ id: m.id, videoId: m.videoId, primaryVirtueId: m.primaryVirtueId, status: m.status })),
    interactionIds: interactions.map((i) => i.id),
  };
}

const latest = (a: Date | null, b: Date | null) => (a === null ? b : b === null ? a : a > b ? a : b);

function contactOf(u: { username: string | null; email: string }) {
  return { username: u.username, email: u.username ? null : u.email };
}

/** Every student, most recently active first (students with no activity yet come last, by name). */
export async function listTeacherStudents(): Promise<TeacherStudentRow[]> {
  const users = await db.orm.public.User.where({ role: "STUDENT" }).all();
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);
  const [progress, responses, teacherRatings] = await Promise.all([
    db.orm.public.ModuleProgress.where((p) => p.userId.in(ids)).all(),
    db.orm.public.InteractionResponse.where((r) => r.userId.in(ids)).all(),
    db.orm.public.VirtueRating.where({ raterKind: "TEACHER" }).where((r) => r.studentId.in(ids)).all(),
  ]);

  return users
    .map((u): TeacherStudentRow => {
      const mine = progress.filter((p) => p.userId === u.id);
      const answered = responses.filter((r) => r.userId === u.id);
      const lastActive = [...mine.map((p) => p.updatedAt), ...answered.map((r) => r.updatedAt)].reduce<Date | null>(latest, null);
      const rating = teacherRatings.filter((r) => r.studentId === u.id).sort((a, b) => b.ratedAt.getTime() - a.ratedAt.getTime())[0];
      return {
        id: u.id,
        name: u.name,
        ...contactOf(u),
        avatar: u.avatar,
        storiesCompleted: mine.filter((p) => p.completedAt !== null).length,
        storiesStarted: mine.length,
        lastActive,
        lastTeacherRating: rating ? { at: rating.ratedAt, raterName: rating.raterName } : null,
      };
    })
    .sort((a, b) => (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0) || a.name.localeCompare(b.name));
}

/** Throws NOT_FOUND unless `studentId` is a STUDENT (a teacher id and an unknown id look the same). */
export async function assertStudentExists(studentId: number): Promise<void> {
  const student = await db.orm.public.User.where({ id: studentId, role: "STUDENT" }).first();
  if (!student) throw new AuthError("NOT_FOUND", "Student not found.");
}

export type NewStudentInput = { name: string; username: string; pin: string };

/**
 * A teacher creates a student sign-in. Children have no email, so the row gets a placeholder address on the reserved
 * `.invalid` TLD (never deliverable) and an unusable random password; the student signs in with username + PIN only.
 * Throws VALIDATION_ERROR (with fields) or CONFLICT when the username is taken.
 */
export async function createStudentAccount(input: NewStudentInput): Promise<{ id: number; name: string; username: string }> {
  const name = input.name.trim().replace(/\s+/g, " ");
  const username = normalizeUsername(input.username);
  const fields: Record<string, string> = {};
  if (!name) fields.name = "Type the child's name.";
  else if (name.length > 100) fields.name = "Name must be at most 100 characters.";
  if (!USERNAME_PATTERN.test(username)) fields.username = "3-20 characters: a-z, 0-9 or _ (no spaces).";
  if (!PIN_PATTERN.test(input.pin)) fields.pin = "The PIN must be exactly 4 digits.";
  if (Object.keys(fields).length > 0) throw new AuthError("VALIDATION_ERROR", "Check the details and try again.", fields);

  const [pinHash, password] = await Promise.all([hashPassword(input.pin), hashPassword(randomBytes(32).toString("hex"))]);
  try {
    const user = await db.orm.public.User.create({
      name,
      email: `${username}@students.parichay.invalid`,
      password,
      role: "STUDENT",
      username,
      pinHash,
    });
    return { id: user.id, name: user.name, username };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthError("CONFLICT", "That username is already taken.", { username: "That username is already taken." });
    }
    throw error;
  }
}

const STATUS_ORDER: Record<StudentStatus, number> = { completed: 0, "in-progress": 1, "not-started": 2 };

/** The student's header facts, their progress on each of the teacher's modules and the latest teacher ratings. */
export async function getTeacherStudentDetail(studentId: number): Promise<TeacherStudentDetail> {
  await assertStudentExists(studentId);
  const scope = await contentScope();
  const moduleIds = scope.modules.map((m) => m.id);
  const [user, virtues, progress, responses, ratings] = await Promise.all([
    db.orm.public.User.where({ id: studentId }).first(),
    db.orm.public.Virtue.orderBy((v) => v.position.asc()).all(),
    moduleIds.length === 0 ? Promise.resolve([]) : db.orm.public.ModuleProgress.where({ userId: studentId }).where((p) => p.moduleId.in(moduleIds)).all(),
    scope.interactionIds.length === 0
      ? Promise.resolve([])
      : db.orm.public.InteractionResponse.where({ userId: studentId }).where((r) => r.interactionId.in(scope.interactionIds)).all(),
    db.orm.public.VirtueRating.where({ studentId, raterKind: "TEACHER" }).all(),
  ]);
  if (!user) throw new AuthError("NOT_FOUND", "Student not found.");
  const slugOf = new Map(virtues.map((v) => [v.id, v.slug]));
  const progressOf = new Map(progress.map((p) => [p.moduleId, p]));

  const stories: TeacherStudentStory[] = scope.modules
    .filter((m) => m.status === "PUBLISHED" || progressOf.has(m.id))
    .map((m) => {
      const p = progressOf.get(m.id);
      return {
        moduleId: m.id,
        title: scope.titleOf.get(m.videoId) ?? "Untitled story",
        primaryVirtueSlug: slugOf.get(m.primaryVirtueId) ?? "",
        published: m.status === "PUBLISHED",
        status: (p?.completedAt ? "completed" : p ? "in-progress" : "not-started") as StudentStatus,
        completedAt: p?.completedAt ?? null,
        lastActive: p?.updatedAt ?? null,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (b.completedAt?.getTime() ?? b.lastActive?.getTime() ?? 0) - (a.completedAt?.getTime() ?? a.lastActive?.getTime() ?? 0) ||
        a.title.localeCompare(b.title),
    );

  // The engine uses the newest rating of each virtue, so the form is prefilled the same way.
  const newestFirst = [...ratings].sort((a, b) => b.ratedAt.getTime() - a.ratedAt.getTime());
  const byVirtue: Record<number, number> = {};
  for (const r of newestFirst) if (!(r.virtueId in byVirtue)) byVirtue[r.virtueId] = r.rating;
  const newest = newestFirst[0];

  const lastActive = [...progress.map((p) => p.updatedAt), ...responses.map((r) => r.updatedAt)].reduce<Date | null>(latest, null);
  return {
    student: {
      id: user.id,
      name: user.name,
      ...contactOf(user),
      avatar: user.avatar,
      storiesCompleted: progress.filter((p) => p.completedAt !== null).length,
      storiesStarted: progress.length,
      lastActive,
    },
    stories,
    virtues: virtues.map((v) => ({ id: v.id, slug: v.slug, name: v.name })),
    latestTeacherRatings: newest ? { ratings: byVirtue, at: newest.ratedAt, raterName: newest.raterName, notes: newest.notes } : null,
  };
}

/**
 * Appends one teacher rating set (history is kept; the engine reads the newest rating per virtue). The rater is the
 * teacher's account name, the mark is always NONE, and the set's note is stored on each row of the set.
 */
export async function saveTeacherRatings(teacher: { id: number; name: string }, studentId: number, body: unknown): Promise<{ saved: number; at: Date }> {
  await assertStudentExists(studentId);
  const virtues = await db.orm.public.Virtue.all();
  const parsed = validateTeacherRatings(body, virtues.map((v) => v.id));
  if (parsed.errors) throw new AuthError("VALIDATION_ERROR", "Check the ratings and try again.", parsed.errors);
  const at = new Date();
  await db.orm.public.VirtueRating.createAll(
    parsed.value.ratings.map((r) => ({
      studentId,
      raterKind: "TEACHER" as const,
      raterName: teacher.name,
      virtueId: r.virtueId,
      rating: r.rating,
      mark: "NONE" as const,
      notes: parsed.value.notes,
      ratedAt: at,
    })),
  );
  return { saved: parsed.value.ratings.length, at };
}

/**
 * The only way the teacher report page gets report data (mirrors lib/reports/access.ts): the student is checked FIRST, then the
 * view is written to the access log (actor = teacher, subject = student), then the report and the log are read.
 */
export async function openTeacherReport(teacherId: number, studentId: number): Promise<{ report: ParentReport; access: AuditEntry[] }> {
  await assertStudentExists(studentId);
  await logReportAccess(teacherId, studentId, "REPORT_VIEW");
  const [report, access] = await Promise.all([getParentReport(studentId), recentReportAccess(studentId, 10)]);
  return { report, access };
}

/** Logged when the teacher prints / saves the report as PDF. */
export async function recordTeacherReportPrint(teacherId: number, studentId: number): Promise<void> {
  await assertStudentExists(studentId);
  await logReportAccess(teacherId, studentId, "REPORT_PRINT");
}
