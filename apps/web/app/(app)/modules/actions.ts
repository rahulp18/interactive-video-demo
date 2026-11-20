"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { requireTeacher } from "@/lib/auth/server";
import type { ModuleStatus } from "@/lib/teacher/modules-model";
import { createModule, setModuleStatus, updateModuleDetails } from "@/lib/teacher/modules";

// Server actions for story modules. Each one re-checks the teacher role and ownership in the service (the module's video
// must be the caller's); ids from the browser are only references, never trusted for anything else.

export type ModuleActionResult = { ok: true; message?: string } | { ok: false; message: string; fields?: Record<string, string> };

const isId = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 2_147_483_647;

function failure(error: unknown): ModuleActionResult {
  if (error instanceof AuthError) {
    if (error.code === "NOT_FOUND") return { ok: false, message: "This module no longer exists." };
    return { ok: false, message: error.code === "VALIDATION_ERROR" ? "Please fix the highlighted fields." : error.message, fields: error.fields };
  }
  console.error("Module action failed:", error);
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function createModuleAction(videoId: number, details: unknown): Promise<ModuleActionResult> {
  const user = await requireTeacher();
  if (!isId(videoId)) return { ok: false, message: "Choose one of your videos." };
  let id: number;
  try {
    id = await createModule(user.id, videoId, details);
  } catch (error) {
    return failure(error);
  }
  redirect(`/modules/${id}?created=1`);
}

export async function saveModuleDetailsAction(moduleId: number, details: unknown): Promise<ModuleActionResult> {
  const user = await requireTeacher();
  if (!isId(moduleId)) return { ok: false, message: "This module no longer exists." };
  try {
    await updateModuleDetails(user.id, moduleId, details);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: "Details saved." };
}

export async function setModuleStatusAction(moduleId: number, status: ModuleStatus): Promise<ModuleActionResult> {
  const user = await requireTeacher();
  if (!isId(moduleId) || (status !== "DRAFT" && status !== "PUBLISHED")) return { ok: false, message: "Invalid request." };
  try {
    await setModuleStatus(user.id, moduleId, status);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: status === "PUBLISHED" ? "Published. Children can now find this story." : "Moved back to draft. Children can no longer open it." };
}
