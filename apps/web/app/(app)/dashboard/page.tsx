import {
  ArrowRightIcon,
  BookOpenIcon,
  CircleCheckIcon,
  GraduationCapIcon,
  MessageSquareTextIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Mascot } from "@/components/brand/Mascot";
import { EmptyState } from "@/components/layout/PageHeader";
import { StudentAvatar } from "@/components/teacher/students/StudentAvatar";
import { ModuleStatusBadge, VirtueTile } from "@/components/teacher/VirtuePill";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireTeacher } from "@/lib/auth/server";
import { getTeacherDashboard, type TeacherDashboard } from "@/lib/teacher/dashboard";
import { virtueDisplay, virtueTint } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

const ago = (d: Date, now: Date) => {
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
};

async function DashboardContent() {
  const user = await requireTeacher();
  const data = await getTeacherDashboard(user.id);
  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const learners = data.students.length;

  const tiles = [
    { label: "Published stories", value: data.publishedCount, sub: data.draftCount > 0 ? `${data.draftCount} in draft` : "All published", href: "/modules", icon: BookOpenIcon, tone: "bg-accent text-accent-foreground" },
    { label: "Students", value: learners, sub: "using your stories", href: "/students", icon: GraduationCapIcon, tone: "bg-secondary text-secondary-foreground" },
    { label: "Stories finished", value: data.finishedLast30Days, sub: "in the last 30 days", href: "/students", icon: CircleCheckIcon, tone: "bg-success/12 text-success" },
    { label: "Answers recorded", value: data.answerCount, sub: "by children, on your stories", href: "/students", icon: MessageSquareTextIcon, tone: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,var(--primary)_0%,color-mix(in_oklch,var(--primary),black_35%)_100%)] p-6 text-primary-foreground shadow-sm sm:p-8">
        <span aria-hidden className="absolute -top-20 -right-16 size-64 rounded-full border border-primary-foreground/20" />
        <span aria-hidden className="absolute -right-4 -bottom-24 size-64 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="relative flex items-center justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Welcome back, {firstName}!</h1>
            <p className="mt-2 text-base text-primary-foreground/90 sm:text-lg">
              {data.modules.length === 0
                ? "Upload a story video, turn it into a story module and tag its answers with virtues. Children grow their Virtue Tree as they watch."
                : learners === 0
                  ? "Your stories are ready. Children appear here as soon as they start one."
                  : `${learners} ${learners === 1 ? "child is" : "children are"} growing virtues through your ${data.publishedCount === 1 ? "story" : "stories"}.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={data.modules.length === 0 ? "/upload" : "/modules/new"} className={cn(buttonVariants({ variant: "secondary" }), "h-11 rounded-xl px-5 font-bold")}>
                <PlusIcon aria-hidden /> {data.modules.length === 0 ? "Upload a story video" : "New story module"}
              </Link>
              <Link
                href="/students"
                className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 font-bold text-primary-foreground outline-none hover:bg-primary-foreground/15 focus-visible:ring-3 focus-visible:ring-primary-foreground/50"
              >
                See students <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
          <div aria-hidden className="hidden size-36 shrink-0 md:block lg:size-40">
            <Mascot />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ label, value, sub, href, icon: Icon, tone }) => (
          <Link key={label} href={href} className="group rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:ring-primary/30">
              <CardContent className="flex items-center gap-4">
                <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", tone)}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-muted-foreground">{label}</p>
                  <p className="text-3xl leading-tight font-extrabold tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                    {value}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{sub}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <RecentActivity data={data} />
        <Attention data={data} />
      </div>

      <Coverage data={data} />
    </div>
  );
}

function RecentActivity({ data }: { data: TeacherDashboard }) {
  const now = new Date();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-extrabold">Recent activity</CardTitle>
        <CardDescription>Children watching and finishing your stories.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.activity.length === 0 ? (
          <EmptyState
            icon={<PlayIcon className="size-6" aria-hidden />}
            title="No activity yet"
            description="When a child starts one of your published stories, it shows up here."
          />
        ) : (
          <ul className="divide-y" data-testid="activity-list">
            {data.activity.map((a) => (
              <li key={`${a.studentId}-${a.moduleId}`}>
                <Link
                  href={`/students/${a.studentId}`}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <StudentAvatar name={a.studentName} avatar={a.avatar} className="size-10 text-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      <strong className="font-bold">{a.studentName}</strong> {a.completed ? "finished" : "is watching"}{" "}
                      <strong className="font-bold">{a.title}</strong>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {a.completed ? <CircleCheckIcon className="size-3.5 text-success" aria-hidden /> : <PlayIcon className="size-3.5" aria-hidden />}
                      {a.completed ? "Completed" : "In progress"} · {ago(a.at, now)}
                    </span>
                  </span>
                  <VirtueTile slug={a.virtueSlug} className="size-9 rounded-xl" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Attention({ data }: { data: TeacherDashboard }) {
  const { modules, unratedStudents } = data.attention;
  const empty = modules.length === 0 && unratedStudents.length === 0 && data.unsetVideos.length === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-extrabold">To do</CardTitle>
        <CardDescription>Stories to finish and children waiting for your rating.</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-3 text-sm font-semibold text-success">
            <SparklesIcon className="size-4" aria-hidden /> All caught up. Every story is published and every active child is rated.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.unsetVideos.slice(0, 3).map((v) => (
              <li key={`v${v.id}`}>
                <Link
                  href={`/modules/new?video=${v.id}`}
                  className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-2.5 text-sm outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground" aria-hidden>
                    <BookOpenIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{v.title}</span>
                    <span className="text-xs text-warning">Uploaded, not set up as a story yet</span>
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
            {modules.slice(0, 4).map((m) => (
              <li key={`m${m.id}`}>
                <Link href={`/modules/${m.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-2.5 text-sm outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50">
                  <VirtueTile slug={m.primary.slug} className="size-9 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{m.title}</span>
                    <span className="flex items-center gap-1 text-xs text-warning">
                      <TriangleAlertIcon className="size-3" aria-hidden />
                      {m.questionCount === 0
                        ? "Add questions"
                        : m.textQuestionCount > 0
                          ? "Typed answers to change"
                          : m.weightedQuestionCount < m.questionCount
                            ? "Tag answers with virtues"
                            : "Ready to publish"}
                    </span>
                  </span>
                  <ModuleStatusBadge status={m.status} />
                </Link>
              </li>
            ))}
            {unratedStudents.slice(0, 4).map((s) => (
              <li key={`s${s.id}`}>
                <Link
                  href={`/students/${s.id}#rating-heading`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-2.5 text-sm outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <StudentAvatar name={s.name} avatar={s.avatar} className="size-9 text-base" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">Rate {s.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <StarIcon className="size-3" aria-hidden /> No teacher rating yet
                    </span>
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Coverage({ data }: { data: TeacherDashboard }) {
  const gaps = data.coverage.filter((c) => c.published === 0).length;
  return (
    <section aria-labelledby="coverage-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="coverage-heading" className="text-xl font-extrabold tracking-tight">
            Virtue coverage
          </h2>
          <p className="text-sm text-muted-foreground">
            Published stories per virtue (main virtue, plus where it supports another story).
            {gaps > 0 && ` ${gaps} ${gaps === 1 ? "virtue has" : "virtues have"} no story of its own yet.`}
          </p>
        </div>
        <Link href="/modules" className="text-sm font-bold text-primary hover:underline">
          All story modules
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="coverage">
        {data.coverage.map((c) => {
          const d = virtueDisplay(c.slug, c.name);
          const Icon = d.icon;
          return (
            <li key={c.id} className={cn("rounded-2xl border bg-card p-3", c.published === 0 && "border-dashed")} style={c.published > 0 ? virtueTint(d.color, 8) : undefined}>
              <p className="flex items-center gap-2 text-sm font-bold">
                <Icon className="size-4 shrink-0" style={{ color: d.color }} aria-hidden />
                <span className="truncate">{c.name}</span>
              </p>
              <p className="mt-1.5 text-2xl font-extrabold tabular-nums">
                {c.published}
                <span className="ml-1 text-xs font-semibold text-muted-foreground">{c.published === 1 ? "story" : "stories"}</span>
              </p>
              <p className="text-xs text-muted-foreground">{c.supporting > 0 ? `+ supports ${c.supporting}` : c.published === 0 ? "Gap: no story yet" : " "}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading dashboard">
      <Skeleton className="h-48 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
