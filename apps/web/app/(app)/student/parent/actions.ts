"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { logReportAccess } from "@/lib/reports/audit";
import { endGate, getChallenge, hasGatePass, submitAnswer, type AnswerReply, type ChallengeReply } from "@/lib/reports/gate";

// Server actions for the parental gate. Each one re-checks that the caller is a signed-in student and works on THIS
// session only. The expected answer never leaves the database: the browser gets the question text and a verdict.

async function context() {
  const user = await requireStudent();
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/login");
  return { user, token };
}

export async function loadChallenge(): Promise<ChallengeReply> {
  const { token } = await context();
  return getChallenge(token);
}

export async function answerChallenge(answer: number): Promise<AnswerReply> {
  const { token } = await context();
  return submitAnswer(token, Number(answer));
}

/** "Back to <name>'s app": closes the gate at once, so it is needed again next time. */
export async function leaveParentZone(): Promise<void> {
  const { token } = await context();
  await endGate(token);
  redirect("/student");
}

/** Called when the grown-up prints / saves as PDF. Only counts while the gate is open. */
export async function recordPrint(): Promise<void> {
  const { user, token } = await context();
  if (!(await hasGatePass(token))) return;
  await logReportAccess(user.id, user.id, "REPORT_PRINT");
}
