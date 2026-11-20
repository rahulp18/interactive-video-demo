import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ParentGate } from "@/components/student/parent/ParentGate";
import { PrintButton } from "@/components/student/parent/PrintButton";
import { ReportView } from "@/components/student/parent/ReportView";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { requireStudent } from "@/lib/auth/server";
import { openParentReport } from "@/lib/reports/access";
import { hasGatePass } from "@/lib/reports/gate";
import { leaveParentZone, recordPrint } from "./actions";

export const metadata: Metadata = { title: "For grown-ups" };

// Parent preview. Nothing is cached. The report is loaded only after the server confirms the grown-up check for THIS
// session, so before it the HTML holds the gate and nothing from the report. This is a gate against children
// wandering in; access control is requireStudent plus "it is the child's own data".
export default function Page() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="For grown-ups" description="A preview of the adult report for this account." />
      </div>
      <Suspense fallback={<Skeleton className="h-96 max-w-3xl rounded-2xl" role="status" aria-label="Loading" />}>
        <Gated />
      </Suspense>
    </>
  );
}

async function Gated() {
  const user = await requireStudent();
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/login");
  if (!(await hasGatePass(token))) return <ParentGate />;
  const { report, access } = await openParentReport(user.id, token);
  return (
    <ReportView
      report={report}
      access={access}
      audience="parent"
      toolbar={
        <>
          <form action={leaveParentZone}>
            <Button type="submit" variant="outline">
              Back to {report.child.name}&apos;s app
            </Button>
          </form>
          <PrintButton onPrint={recordPrint} />
        </>
      }
    />
  );
}
