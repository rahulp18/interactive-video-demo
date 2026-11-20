import "server-only";
import { logReportAccess, recentReportAccess } from "./audit";
import { hasGatePass } from "./gate";
import { getParentReport } from "./service";
import type { AuditEntry, ParentReport } from "./types";

export class GateClosedError extends Error {
  constructor() {
    super("The grown-up check has not been passed on this session.");
  }
}

/**
 * The ONLY way the page gets report data. The gate pass is checked first (so no report query runs without it), then the
 * view is written to the access log, then the report and the log list are read. `userId` is the signed-in student's own
 * id: this is the child's own data (access control is `requireStudent`; the gate only keeps children out).
 */
export async function openParentReport(userId: number, sessionToken: string): Promise<{ report: ParentReport; access: AuditEntry[] }> {
  if (!(await hasGatePass(sessionToken))) throw new GateClosedError();
  await logReportAccess(userId, userId, "REPORT_VIEW");
  const [report, access] = await Promise.all([getParentReport(userId), recentReportAccess(userId, 10)]);
  return { report, access };
}
