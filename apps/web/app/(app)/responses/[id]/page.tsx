import { ArrowLeftIcon, CheckIcon, DownloadIcon, PencilIcon, UsersIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TypeBadge } from "@/components/editor/TypeBadge";
import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthError } from "@/lib/auth/errors";
import { requireCurrentUser } from "@/lib/auth/server";
import { formatPreciseTimestamp } from "@/lib/interactions/model";
import { getResponseSummary, type InteractionStat, type Respondent } from "@/lib/responses/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Video responses" };

export default function VideoResponsesPage({ params }: PageProps<"/responses/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Loading responses" />}>
      <Results params={params} />
    </Suspense>
  );
}

const percent = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
const when = (iso: string) => new Date(iso).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

async function Results({ params }: Pick<PageProps<"/responses/[id]">, "params">) {
  const user = await requireCurrentUser();
  const raw = (await params).id;
  const id = /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) notFound();

  let summary;
  try {
    summary = await getResponseSummary(user.id, id);
  } catch (error) {
    if (error instanceof AuthError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const quizAnswered = summary.interactions.filter((i) => i.type === "QUIZ").reduce((n, i) => n + i.answered, 0);
  const quizCorrect = summary.interactions.reduce((n, i) => n + (i.correctRate === null ? 0 : Math.round(i.correctRate * i.answered)), 0);

  return (
    <>
      <Link href="/responses" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> All responses
      </Link>
      <PageHeader
        title={summary.video.title}
        description="Who responded and how they answered."
        actions={
          <>
            <Link href={`/videos/${id}`} className={buttonVariants({ variant: "outline" })}>
              <PencilIcon aria-hidden /> Edit video
            </Link>
            {summary.respondentCount > 0 && (
              <a href={`/api/videos/${id}/responses?format=csv`} className={buttonVariants({ variant: "outline" })} data-testid="csv-link">
                <DownloadIcon aria-hidden /> Download CSV
              </a>
            )}
          </>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="People responded" value={summary.respondentCount} testId="stat-respondents" />
        <Stat label="Total answers" value={summary.totalResponses} testId="stat-answers" />
        <Stat label="Quiz accuracy" value={quizAnswered > 0 ? `${percent(quizCorrect, quizAnswered)}%` : "–"} testId="stat-accuracy" />
      </div>

      {summary.interactions.length === 0 ? (
        <EmptyState icon={<UsersIcon className="size-5" aria-hidden />} title="No questions yet" description="Add a survey or quiz in the editor first." />
      ) : (
        <>
          <section aria-labelledby="by-question" className="mb-10 space-y-4">
            <h2 id="by-question" className="text-lg font-semibold tracking-tight">
              By question
            </h2>
            {summary.interactions.map((i) => (
              <QuestionCard key={i.id} stat={i} />
            ))}
          </section>

          <section aria-labelledby="by-person" className="space-y-3">
            <h2 id="by-person" className="text-lg font-semibold tracking-tight">
              By person <span className="font-normal text-muted-foreground">({summary.respondentCount})</span>
            </h2>
            {summary.respondentCount === 0 ? (
              <EmptyState
                icon={<UsersIcon className="size-5" aria-hidden />}
                title="No responses yet"
                description="Share the public link or list the video in the Library. Responses are saved for signed-in viewers."
                action={
                  <Link href={`/videos/${id}`} className={buttonVariants()}>
                    Open the editor to share
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2" data-testid="respondent-list">
                {summary.respondents.map((p) => (
                  <RespondentRow key={p.userId} person={p} interactions={summary.interactions} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Stat({ label, value, testId }: { label: string; value: number | string; testId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums" data-testid={testId}>
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function QuestionCard({ stat }: { stat: InteractionStat }) {
  return (
    <Card data-testid="question-card">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{formatPreciseTimestamp(stat.timestamp)}</span>
          <TypeBadge type={stat.type} />
          <span>
            {stat.answered} answered{stat.skipped > 0 ? ` · ${stat.skipped} skipped` : ""}
            {stat.correctRate !== null ? ` · ${percent(Math.round(stat.correctRate * stat.answered), stat.answered)}% correct` : ""}
          </span>
        </div>
        <CardTitle className="text-base break-words">{stat.question}</CardTitle>
      </CardHeader>
      <CardContent>
        {stat.answerType === "TEXT" ? (
          <div className="space-y-2" data-testid="text-answers">
            {stat.correctAnswer && (
              <p className="text-sm text-muted-foreground">
                Expected answer: <span className="font-medium text-foreground">{stat.correctAnswer}</span>
              </p>
            )}
            {stat.textAnswers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No typed answers yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {stat.textAnswers.map((a, idx) => (
                  <li key={idx} className="flex items-start gap-2 px-3 py-2 text-sm">
                    {a.correct === true && <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Correct" />}
                    {a.correct === false && <XIcon className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="Incorrect" />}
                    <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">{a.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{a.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
        <ul className="space-y-2.5">
          {stat.options.map((o) => {
            const pct = percent(o.count, stat.answered);
            return (
              <li key={o.id} className="space-y-1" data-testid="option-stat">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {o.isCorrect && <CheckIcon className="size-4 shrink-0 text-emerald-600" aria-label="Correct answer" />}
                    <span className="truncate">{o.text}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {o.count} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className={cn("h-full rounded-full", o.isCorrect ? "bg-emerald-500" : "bg-primary/60")} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RespondentRow({ person, interactions }: { person: Respondent; interactions: InteractionStat[] }) {
  const quizzes = interactions.filter((i) => i.type === "QUIZ").length;
  return (
    <li>
      <details className="group rounded-xl border bg-card" data-testid="respondent">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold" aria-hidden>
            {person.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1 basis-48">
            <span className="block truncate text-sm font-medium">{person.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {person.answered} answered{person.skipped > 0 ? ` · ${person.skipped} skipped` : ""}
            {quizzes > 0 ? ` · ${person.correct} correct` : ""}
          </span>
          <span className="text-xs text-muted-foreground">{when(person.lastActivity)}</span>
        </summary>
        <ol className="space-y-2 border-t px-4 py-3">
          {interactions.map((i) => {
            const a = person.answers[i.id];
            if (!a) return null;
            const text = a.text ?? i.options.find((o) => o.id === a.optionId)?.text;
            return (
              <li key={i.id} className="text-sm">
                <p className="text-muted-foreground">
                  <span className="font-mono tabular-nums">{formatPreciseTimestamp(i.timestamp)}</span> · {i.question}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 font-medium">
                  {a.skipped ? (
                    <span className="font-normal text-muted-foreground italic">Skipped</span>
                  ) : (
                    <>
                      {a.correct === true && <CheckIcon className="size-4 text-emerald-600" aria-label="Correct" />}
                      {a.correct === false && <XIcon className="size-4 text-red-600" aria-label="Incorrect" />}
                      {text}
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      </details>
    </li>
  );
}
