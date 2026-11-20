import "server-only";
import { db } from "@/prisma/db";
import { listConvertibleVideos, listTeacherModules, listVirtues, type TeacherModuleRow, type VirtueOption } from "./modules";
import { listTeacherStudents, type TeacherStudentRow } from "./students";

// One call for the teacher dashboard. Everything is scoped to the teacher's own content (modules of videos they uploaded)
// and to the students that scope allows (lib/teacher/students.ts). Nothing is cached.

export type ActivityItem = {
  studentId: number;
  studentName: string;
  avatar: string | null;
  moduleId: number;
  title: string;
  virtueSlug: string;
  completed: boolean;
  at: Date;
};

export type CoverageItem = VirtueOption & { published: number; supporting: number };

export type TeacherDashboard = {
  modules: TeacherModuleRow[];
  publishedCount: number;
  draftCount: number;
  /** Uploaded videos not yet set up as story modules. */
  unsetVideos: { id: number; title: string }[];
  students: TeacherStudentRow[];
  finishedLast30Days: number;
  answerCount: number;
  activity: ActivityItem[];
  coverage: CoverageItem[];
  attention: { modules: TeacherModuleRow[]; unratedStudents: TeacherStudentRow[] };
};

const DAY = 24 * 60 * 60 * 1000;

export async function getTeacherDashboard(teacherId: number, now: Date = new Date()): Promise<TeacherDashboard> {
  const [modules, students, unset, virtues] = await Promise.all([
    listTeacherModules(teacherId),
    listTeacherStudents(),
    listConvertibleVideos(teacherId),
    listVirtues(),
  ]);
  const moduleIds = modules.map((m) => m.id);
  const studentOf = new Map(students.map((s) => [s.id, s]));
  const progress = moduleIds.length === 0 ? [] : await db.orm.public.ModuleProgress.where((p) => p.moduleId.in(moduleIds)).all();
  const moduleOf = new Map(modules.map((m) => [m.id, m]));
  // Answers by students in scope to questions of this teacher's story modules.
  const interactionIds =
    modules.length === 0 ? [] : (await db.orm.public.Interaction.where((i) => i.videoId.in(modules.map((m) => m.videoId))).all()).map((i) => i.id);
  const answers =
    interactionIds.length === 0 || students.length === 0
      ? []
      : await db.orm.public.InteractionResponse.where((r) => r.interactionId.in(interactionIds)).where((r) => r.userId.in(students.map((s) => s.id))).all();

  // Only students in scope (role STUDENT) appear; a teacher previewing a story is not "activity".
  const inScope = progress.filter((p) => studentOf.has(p.userId));
  const activity: ActivityItem[] = inScope
    .map((p) => {
      const s = studentOf.get(p.userId)!;
      const m = moduleOf.get(p.moduleId)!;
      const completed = p.completedAt !== null;
      return {
        studentId: s.id,
        studentName: s.name,
        avatar: s.avatar,
        moduleId: m.id,
        title: m.title,
        virtueSlug: m.primary.slug,
        completed,
        at: p.updatedAt,
      };
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  const published = modules.filter((m) => m.status === "PUBLISHED");
  const coverage = virtues.map((v) => ({
    ...v,
    published: published.filter((m) => m.primary.id === v.id).length,
    supporting: published.filter((m) => m.secondary.some((s) => s.id === v.id)).length,
  }));

  return {
    modules,
    publishedCount: published.length,
    draftCount: modules.length - published.length,
    unsetVideos: unset.map((v) => ({ id: v.id, title: v.title })),
    students,
    finishedLast30Days: inScope.filter((p) => p.completedAt !== null && now.getTime() - p.completedAt.getTime() <= 30 * DAY).length,
    answerCount: answers.filter((r) => !r.isSkipped).length,
    activity,
    coverage,
    attention: {
      modules: modules.filter((m) => m.status === "DRAFT" || m.questionCount === 0 || m.weightedQuestionCount < m.questionCount || m.textQuestionCount > 0),
      unratedStudents: students.filter((s) => s.storiesCompleted > 0 && s.lastTeacherRating === null),
    },
  };
}
