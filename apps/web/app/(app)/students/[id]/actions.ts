"use server";

import { refresh } from "next/cache";
import { AuthError } from "@/lib/auth/errors";
import { requireTeacher } from "@/lib/auth/server";
import { recordTeacherReportPrint, saveTeacherRatings } from "@/lib/teacher/students";

// Server actions for the teacher's student report. Each one re-checks the TEACHER role and that the student is in this
// teacher's scope (see lib/teacher/students.ts); the student id is a reference only, never trusted on its own.

export type SaveRatingsResult = { ok: true; saved: number; at: string } | { ok: false; error: string; fields?: Record<string, string> };

const validId = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647;

export async function saveRatings(studentId: number, input: unknown): Promise<SaveRatingsResult> {
  const teacher = await requireTeacher();
  if (!validId(studentId)) return { ok: false, error: "Student not found." };
  try {
    const { saved, at } = await saveTeacherRatings({ id: teacher.id, name: teacher.name }, studentId, input);
    // The report on this page reads the ratings, so re-render it in the same round trip.
    refresh();
    return { ok: true, saved, at: at.toISOString() };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message, fields: error.fields };
    throw error;
  }
}

/** Called when the teacher prints / saves the report as PDF. */
export async function recordTeacherPrint(studentId: number): Promise<void> {
  const teacher = await requireTeacher();
  if (!validId(studentId)) return;
  await recordTeacherReportPrint(teacher.id, studentId).catch((error) => {
    if (!(error instanceof AuthError)) throw error;
  });
}
