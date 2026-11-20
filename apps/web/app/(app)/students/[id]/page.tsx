import { ArrowLeftIcon, CheckCircle2Icon, CircleDashedIcon, PlayCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { fmtDate } from "@/components/student/parent/format";
import { PrintButton } from "@/components/student/parent/PrintButton";
import { ReportView } from "@/components/student/parent/ReportView";
import { StudentAvatar, studentHandle } from "@/components/teacher/students/StudentAvatar";
import { TeacherRatingForm } from "@/components/teacher/students/TeacherRatingForm";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthError } from "@/lib/auth/errors";
import { requireTeacher } from "@/lib/auth/server";
import { getTeacherStudentDetail, openTeacherReport, type StudentStatus } from "@/lib/teacher/students";
import { virtueDisplay } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";
import { recordTeacherPrint } from "./actions";

export const metadata: Metadata = { title: "Student report" };

export default function StudentReportPage({ params }: PageProps<"/students/[id]">) {
  return (
    <>
      <Link href="/students" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeftIcon className="size-4" aria-hidden /> All students
      </Link>
      <Suspense fallback={<ReportSkeleton />}>
        <StudentReport params={params} />
      </Suspense>
    </>
  );
}

const STATUS: Record<StudentStatus, { label: string; icon: typeof CheckCircle2Icon; className: string }> = {
  completed: { label: "Finished", icon: CheckCircle2Icon, className: "bg-success/10 text-success" },
  "in-progress": { label: "In progress", icon: PlayCircleIcon, className: "bg-accent text-accent-foreground" },
  "not-started": { label: "Not started", icon: CircleDashedIcon, className: "bg-muted text-muted-foreground" },
};

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3 print:hidden">
      <div>
        <h2 id={id} className="text-xl font-extrabold tracking-tight">
          {title}
        </h2>
        {intro && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

async function StudentReport({ params }: Pick<PageProps<"/students/[id]">, "params">) {
  const teacher = await requireTeacher();
  const raw = (await params).id;
  const id = /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) notFound();

  let detail, opened;
  try {
    // Both check that the id is a student first; the report open is also written to the access log (FR-7.14).
    detail = await getTeacherStudentDetail(id);
    opened = await openTeacherReport(teacher.id, id);
  } catch (error) {
    if (error instanceof AuthError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { student, stories, virtues, latestTeacherRatings } = detail;
  const firstName = student.name.trim().split(/\s+/)[0] || student.name;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center gap-4 print:hidden">
        <StudentAvatar name={student.name} avatar={student.avatar} className="size-16 text-3xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight">{student.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {studentHandle(student)} · {student.storiesCompleted} of {student.storiesStarted} {student.storiesStarted === 1 ? "story" : "stories"} finished · Last active{" "}
            {student.lastActive ? fmtDate(student.lastActive) : "not yet"}
          </p>
        </div>
        <nav aria-label="On this page" className="flex flex-wrap gap-2">
          <a href="#stories-heading" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Stories
          </a>
          <a href="#rating-heading" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Teacher rating
          </a>
          <a href="#report-heading" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Virtue report
          </a>
        </nav>
      </header>

      <Section id="stories-heading" title="Stories" intro={`Your story modules and how far ${firstName} has got with each.`}>
        {stories.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">None of your story modules are published yet.</p>
        ) : (
          <Card className="py-0">
            <CardContent className="divide-y px-0">
              {stories.map((s) => {
                const d = virtueDisplay(s.primaryVirtueSlug);
                const Icon = d.icon;
                const status = STATUS[s.status];
                const StatusIcon = status.icon;
                return (
                  <div key={s.moduleId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-testid="student-story">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${d.color}26`, color: d.color }} aria-hidden>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 basis-48">
                      <Link href={`/modules/${s.moduleId}`} className="font-bold hover:underline">
                        {s.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {d.name}
                        {!s.published && " · Draft (hidden from students)"}
                      </p>
                    </div>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", status.className)}>
                      <StatusIcon className="size-3.5" aria-hidden /> {status.label}
                    </span>
                    <span className="w-28 text-right text-xs text-muted-foreground">
                      {s.completedAt ? fmtDate(s.completedAt) : s.lastActive ? fmtDate(s.lastActive) : "—"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </Section>

      <Section
        id="rating-heading"
        title="Your teacher rating"
        intro={
          <>
            1 = rarely shows it, 5 = shows it consistently. Your rating counts 15% of the overall score; the child&apos;s answers 60%, a parent&apos;s 25%. Each save
            is kept as a new set, and the newest rating of each virtue is the one that counts.
            {latestTeacherRatings && (
              <span className="mt-1 block font-semibold text-foreground">
                Last teacher rating: {fmtDate(latestTeacherRatings.at)} by {latestTeacherRatings.raterName}.
              </span>
            )}
          </>
        }
      >
        <TeacherRatingForm
          studentId={student.id}
          studentName={firstName}
          virtues={virtues}
          initial={latestTeacherRatings?.ratings ?? {}}
          initialNotes={latestTeacherRatings?.notes ?? null}
        />
      </Section>

      <section aria-labelledby="report-heading" className="space-y-3">
        <div className="print:hidden">
          <h2 id="report-heading" className="text-xl font-extrabold tracking-tight">
            Virtue report
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">The same report a parent sees, computed from {firstName}&apos;s answers and the latest ratings.</p>
        </div>
        <ReportView
          report={opened.report}
          access={opened.access}
          audience="teacher"
          toolbar={
            <>
              <Link href="/students" className={buttonVariants({ variant: "outline" })}>
                <ArrowLeftIcon aria-hidden /> All students
              </Link>
              <PrintButton onPrint={recordTeacherPrint.bind(null, student.id)} />
            </>
          }
        />
      </section>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading student report">
      <Skeleton className="h-20 w-full max-w-xl rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
