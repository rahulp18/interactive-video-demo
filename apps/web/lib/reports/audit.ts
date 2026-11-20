import "server-only";
import { db } from "@/prisma/db";
import type { AuditEntry } from "./types";

// The access log (FR-7.14 / NFR-9.10): who, which student, what, when. Deliberately NO IP address and no user agent
// (data minimisation); the actor is a user id, the subject is a user id.

export type AuditAction = AuditEntry["action"];

export async function logReportAccess(actorId: number, subjectId: number, action: AuditAction): Promise<void> {
  await db.orm.public.AuditLog.create({ actorId, subjectId, action });
}

/** The latest entries about one student, newest first. */
export async function recentReportAccess(subjectId: number, limit = 10): Promise<AuditEntry[]> {
  const rows = await db.orm.public.AuditLog.where({ subjectId })
    .orderBy((l) => l.at.desc())
    .limit(limit)
    .all();
  if (rows.length === 0) return [];
  const actorIds = [...new Set(rows.map((r) => r.actorId))];
  const actors = await db.orm.public.User.where((u) => u.id.in(actorIds)).all();
  const nameOf = new Map(actors.map((a) => [a.id, a.name]));
  return rows.map((r) => ({ action: r.action as AuditAction, actorName: nameOf.get(r.actorId) ?? "Unknown", at: r.at }));
}
