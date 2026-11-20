"use server";

import { refresh } from "next/cache";
import { AuthError } from "@/lib/auth/errors";
import { requireTeacher } from "@/lib/auth/server";
import { createStudentAccount } from "@/lib/teacher/students";

export type AddStudentResult =
  | { ok: true; name: string; username: string }
  | { ok: false; error: string; fields?: Record<string, string> };

/** A teacher creates a student (name + username + 4-digit PIN). Only the TEACHER role may call this. */
export async function addStudent(input: { name: unknown; username: unknown; pin: unknown }): Promise<AddStudentResult> {
  await requireTeacher();
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  try {
    const created = await createStudentAccount({ name: str(input.name), username: str(input.username), pin: str(input.pin) });
    refresh(); // the list on /students reads the new row
    return { ok: true, name: created.name, username: created.username };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message, fields: error.fields };
    throw error;
  }
}
