import { BookOpenIcon, ChevronRightIcon, GraduationCapIcon, StarIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { fmtDate } from "@/components/student/parent/format";
import { AddStudentForm } from "@/components/teacher/students/AddStudentForm";
import { StudentAvatar, studentHandle } from "@/components/teacher/students/StudentAvatar";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireTeacher } from "@/lib/auth/server";
import { listTeacherStudents } from "@/lib/teacher/students";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Students" };

export default function StudentsPage() {
  return (
    <>
      <PageHeader
        title="Students"
        description="Every child on PARICHAY. Add a student here, then open a report to see their virtue profile and add your teacher rating."
      />
      <AddStudentForm />
      <Suspense fallback={<StudentsSkeleton />}>
        <StudentList />
      </Suspense>
    </>
  );
}

async function StudentList() {
  await requireTeacher();
  const students = await listTeacherStudents();

  if (students.length === 0) {
    return (
      <EmptyState
        icon={<GraduationCapIcon className="size-6" aria-hidden />}
        title="No students yet"
        description="Use the form above to add the first student. They sign in on the student page with the username and PIN you choose."
        action={
          <Link href="/modules" className={buttonVariants()}>
            <BookOpenIcon aria-hidden /> See your story modules
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="student-list">
      {students.map((s) => (
        <li key={s.id}>
          <Link
            href={`/students/${s.id}`}
            className="group block h-full rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            data-testid="student-card"
          >
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:ring-primary/30">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <StudentAvatar name={s.name} avatar={s.avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{studentHandle(s)}</p>
                  </div>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-muted px-3 py-2">
                    <dt className="text-xs text-muted-foreground">Stories finished</dt>
                    <dd className="text-lg font-extrabold tabular-nums">
                      {s.storiesCompleted}
                      <span className="text-xs font-semibold text-muted-foreground"> of {s.storiesStarted} started</span>
                    </dd>
                  </div>
                  <div className="rounded-xl bg-muted px-3 py-2">
                    <dt className="text-xs text-muted-foreground">Last active</dt>
                    <dd className="text-sm font-bold">{s.lastActive ? fmtDate(s.lastActive) : "Not yet"}</dd>
                  </div>
                </dl>
                <p
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                    s.lastTeacherRating ? "bg-success/10 text-success" : "bg-accent text-accent-foreground",
                  )}
                >
                  <StarIcon className="size-3.5" aria-hidden />
                  {s.lastTeacherRating ? `Teacher rating ${fmtDate(s.lastTeacherRating.at)} · ${s.lastTeacherRating.raterName}` : "Not rated by a teacher yet"}
                </p>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StudentsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading students">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-48 rounded-2xl" />
      ))}
    </div>
  );
}
