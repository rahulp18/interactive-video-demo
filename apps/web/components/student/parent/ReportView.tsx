import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon, ChevronRightIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { plottedComposite } from "@/lib/reports/report-rules";
import { avatarFor } from "@/lib/student/avatars";
import type { AuditEntry, ParentReport, ReportSwotItem, ReportVirtueRow } from "@/lib/reports/types";
import { VIRTUE_DISPLAY } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";
import { BAR_PATTERN, CONFIDENCE_LABEL, SERIES, fmtDate, fmtDateTime } from "./format";
import { Radar } from "./Radar";
import { TrendExplorer } from "./TrendExplorer";

const Section = ({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) => (
  <section aria-labelledby={id} className="space-y-3">
    <div>
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {intro && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
    </div>
    {children}
  </section>
);

function VirtueBadge({ slug, name }: { slug: ReportVirtueRow["slug"]; name: string }) {
  const d = VIRTUE_DISPLAY[slug];
  const Icon = d.icon;
  return (
    <span className="inline-flex items-center gap-2 font-medium">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${d.color}26`, color: d.color }}>
        <Icon className="size-4" aria-hidden />
      </span>
      {name}
    </span>
  );
}

function Sparkline({ series }: { series: ReportVirtueRow["series"] }) {
  const W = 120;
  const H = 36;
  if (series.length === 0) return <span className="text-xs text-muted-foreground">No history yet</span>;
  const ts = series.map((p) => p.at.getTime());
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const x = (t: number) => 3 + (t1 === t0 ? (W - 6) / 2 : ((t - t0) / (t1 - t0)) * (W - 6));
  const y = (s: number) => 3 + (1 - s / 100) * (H - 6);
  const last = series.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-30" role="img" aria-label={`Score after each story: ${series.map((p) => Math.round(p.score)).join(", ")}`}>
      <polyline points={series.map((p) => `${x(p.at.getTime())},${y(p.score)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={x(last.at.getTime())} cy={y(last.score)} r={3} fill="currentColor" />
    </svg>
  );
}

function TrendLine({ v }: { v: ReportVirtueRow }) {
  if (v.confidence === "insufficient") return <span className="text-sm text-muted-foreground">Trend not shown yet</span>;
  if (v.trendDelta === null) return <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowRightIcon className="size-4" aria-hidden />No earlier results to compare</span>;
  const d = Math.round(v.trendDelta);
  const Icon = v.trend === "rising" ? ArrowUpRightIcon : v.trend === "falling" ? ArrowDownRightIcon : ArrowRightIcon;
  const word = v.trend === "rising" ? "Rising" : v.trend === "falling" ? "Falling" : "Steady";
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium">
      <Icon className="size-4" aria-hidden />
      {word}, {d > 0 ? "+" : d < 0 ? "−" : ""}
      {Math.abs(d)} <span className="font-normal text-muted-foreground">over 90 days</span>
    </span>
  );
}

function Bar({ kind, value }: { kind: "child" | "parent" | "teacher"; value: number | null }) {
  const label = SERIES[kind].label;
  return (
    <div className="grid grid-cols-[4.2rem_1fr_2rem] items-center gap-2 text-xs">
      <span>{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {value !== null && <span className="block h-full rounded-full" style={{ width: `${Math.max(2, value)}%`, background: BAR_PATTERN[kind] }} />}
      </span>
      <span className="text-right font-medium tabular-nums">{value === null ? "—" : Math.round(value)}</span>
    </div>
  );
}

function VirtueCard({ v }: { v: ReportVirtueRow }) {
  const insufficient = v.confidence === "insufficient";
  return (
    <li className="print-avoid-break rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <VirtueBadge slug={v.slug} name={v.name} />
        <p className="text-right">
          {insufficient || v.composite === null ? (
            <span className="text-sm font-medium">Not enough data yet</span>
          ) : (
            <>
              <span className="text-2xl font-bold tabular-nums">{Math.round(v.composite)}</span>
              <span className="text-xs text-muted-foreground"> / 100</span>
            </>
          )}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", insufficient && "border-dashed")}>{CONFIDENCE_LABEL[v.confidence]}</span>
        <span className="text-xs text-muted-foreground">{v.scoredInteractions} scored answers</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <TrendLine v={v} />
        <Sparkline series={v.series} />
      </div>
      <div className="mt-3 space-y-1.5" role="group" aria-label={`${v.name}: child, parent and teacher views`}>
        <Bar kind="child" value={insufficient ? null : v.child} />
        <Bar kind="parent" value={v.parent} />
        <Bar kind="teacher" value={v.teacher} />
      </div>
      {v.bigGap && (
        <p className="mt-3 rounded-md border border-dashed px-2.5 py-1.5 text-xs" role="note">
          <strong>Views differ:</strong> the parent view and the child&apos;s own answers are 30 or more points apart.
        </p>
      )}
    </li>
  );
}

const QUADRANTS = [
  { key: "strengths", title: "Strengths", sub: "Going well", empty: "No clear strengths have shown up yet." },
  { key: "weaknesses", title: "Still developing", sub: "Weaknesses", empty: "Nothing is standing out as still developing right now." },
  { key: "opportunities", title: "Opportunities", sub: "Coming along, worth encouraging", empty: "No virtue is in the middle range and improving at the moment." },
  { key: "threats", title: "Things to watch", sub: "Threats", empty: "Nothing to watch right now." },
] as const;

function SwotCard({ item, child }: { item: ReportSwotItem; child: string }) {
  return (
    <li className="print-avoid-break rounded-lg border bg-background p-3">
      <VirtueBadge slug={item.slug} name={item.name} />
      <p className="mt-1.5 text-sm">{item.reason}</p>
      {item.evidence.length > 0 && (
        <details className="group mt-2 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-medium underline underline-offset-4 [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            Examples from {child}&apos;s answers ({item.evidence.length})
          </summary>
          <ul className="mt-1 space-y-2 border-l-2 pl-3">
            {item.evidence.map((e) => (
              <li key={e.responseId}>
                In <em>{e.story}</em>, when asked &ldquo;{e.question}&rdquo;, {child} chose &ldquo;{e.answer}&rdquo;.
                <span className="text-muted-foreground"> ({fmtDate(e.at)})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function Mark({ mark }: { mark: "NONE" | "STRENGTH" | "IMPROVE" }) {
  return <>{mark === "STRENGTH" ? "Strength" : mark === "IMPROVE" ? "To work on" : "—"}</>;
}

/** Who is reading. The report itself is the same; a few labels and links differ. */
export type ReportAudience = "parent" | "teacher";

/**
 * The adult-facing report. `toolbar` holds the page's own actions (the parent preview: "Back to <name>'s app" + print;
 * the teacher view: back link + print), shown above the header and hidden in print.
 */
export function ReportView({
  report,
  access,
  toolbar,
  audience = "parent",
}: {
  report: ParentReport;
  access: AuditEntry[];
  toolbar?: ReactNode;
  audience?: ReportAudience;
}) {
  const child = report.child.name;
  const teacher = audience === "teacher";
  const avatar = avatarFor(report.child.avatar);
  const { swot, nextSteps, parentInputs } = report;
  const axes = report.virtues.map((v) => ({
    slug: v.slug,
    name: v.name,
    composite: plottedComposite(v),
    parent: v.parent,
    teacher: v.teacher,
    insufficient: v.confidence === "insufficient",
  }));
  const trendVirtues = report.virtues.map((v) => ({
    slug: v.slug,
    name: v.name,
    insufficient: v.confidence === "insufficient",
    points: v.series.map((p) => ({ label: fmtDate(p.at), score: p.score, t: p.at.getTime() })),
  }));
  const learnedChange = parentInputs.rows.some((r) => r.change);

  return (
    <div className="adult-report space-y-8 rounded-2xl border p-4 sm:p-6">
      {/* 1. Header, with the disclaimer up front */}
      <header className="space-y-4">
        {toolbar && <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">{toolbar}</div>}
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-3xl" aria-hidden>
            {avatar?.emoji ?? child.slice(0, 1)}
          </span>
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{teacher ? "Teacher view" : "Parent preview"}</p>
            <h1 className="text-2xl font-bold tracking-tight">{child}&apos;s PARICHAY report</h1>
            <p className="text-sm text-muted-foreground">
              As of {fmtDate(report.asOf)} · Scoring rules {report.ruleVersion}
            </p>
          </div>
        </div>
        <div role="note" className="flex gap-3 rounded-xl border-2 p-4">
          <ShieldAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm">
            <strong>Please read first.</strong> {report.disclaimer}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {teacher
            ? `You can see this report because ${child} has used your story modules. Opening or printing it is written to the access log at the bottom, which the family can also see.`
            : `This is a preview inside ${child}'s own account. In the full product, parents and carers have their own dashboard.`}
        </p>
      </header>

      {/* 2. Summary */}
      <Section id="summary" title="Summary">
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ["Stories finished", String(report.child.storiesFinished)],
            ["Last active", report.child.lastActive ? fmtDate(report.child.lastActive) : "Not yet"],
            ["Virtues with enough data", `${report.virtues.filter((v) => v.confidence !== "insufficient").length} of ${report.virtues.length}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm">{report.summary.dataSentence}</p>
        <p className="text-sm font-medium">{report.summary.strengthsSentence}</p>
      </Section>

      {/* 3. Radar */}
      <Section id="radar" title="The ten virtues at a glance" intro="The solid shape is the overall score: a blend of the child's story answers (60%), the parent's rating (25%) and the teacher's rating (15%), using whichever are available. A hollow, dashed axis means not enough data yet; it is never drawn as zero.">
        <div className="print-avoid-break">
          <Radar axes={axes} />
        </div>
      </Section>

      {/* 4. Virtue cards */}
      <Section id="virtues" title="Each virtue" intro="Confidence reflects how many answered questions sit behind the score. Bars show the child's own answers, the parent's rating and the teacher's rating, each out of 100.">
        <ul className="grid gap-3 md:grid-cols-2">
          {report.virtues.map((v) => (
            <VirtueCard key={v.virtueId} v={v} />
          ))}
        </ul>
      </Section>

      {/* 5. SWOT */}
      <Section id="swot" title="Strengths, growth areas and things to watch" intro={`Each point comes with examples of what ${child} actually answered. These describe where a child is right now; they are not labels.`}>
        <div className="grid gap-3 md:grid-cols-2">
          {QUADRANTS.map((q) => (
            <div key={q.key} className="rounded-xl border bg-card p-4">
              <h3 className="font-semibold">
                {q.title} <span className="text-xs font-normal text-muted-foreground">({q.sub})</span>
              </h3>
              {swot[q.key].length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{q.empty}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {swot[q.key].map((item) => (
                    <SwotCard key={`${q.key}-${item.virtueId}`} item={item} child={child} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* 6. Next steps */}
      <Section id="next" title="Next steps">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="print-avoid-break rounded-xl border bg-card p-4">
            <h3 className="font-semibold">Stories to try</h3>
            {nextSteps.stories.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No suggestions yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {nextSteps.stories.map((s) => (
                  <li key={s.moduleId}>
                    {teacher ? (
                      <span className="font-medium">{s.title}</span>
                    ) : (
                      <Link href={`/student/modules/${s.moduleId}`} className="font-medium underline underline-offset-4">
                        {s.title}
                      </Link>
                    )}{" "}
                    <span className="text-muted-foreground">
                      · {s.virtueName}
                      {s.completed ? " · already watched" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="print-avoid-break rounded-xl border bg-card p-4">
            <h3 className="font-semibold">{teacher ? "Follow-up activities" : "Activities to do at home"}</h3>
            {nextSteps.stories.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No suggestions yet.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                {nextSteps.stories.map((s) => (
                  <li key={s.moduleId}>
                    {s.activity} <span className="text-muted-foreground">({s.title})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="print-avoid-break rounded-xl border bg-card p-4 md:col-span-2">
            <h3 className="font-semibold">{teacher ? "Discussion questions for class or home" : "Questions to talk about together"}</h3>
            {nextSteps.questions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No suggestions yet.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                {nextSteps.questions.map((q, i) => (
                  <li key={i}>
                    {q.question} <span className="text-muted-foreground">({q.virtueName})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {nextSteps.experts.length > 0 && (
            <div className="print-avoid-break rounded-xl border bg-card p-4 md:col-span-2">
              <h3 className="font-semibold">{teacher ? "If it continues, the family might consider talking to someone" : "If it continues, you might consider talking to someone"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                These areas have stayed on the lower side across more than one reading. This is only a suggestion; there is nothing to book here, and it is not a diagnosis.
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {nextSteps.experts.map((e) => (
                  <li key={e.virtueId}>
                    For <strong>{e.virtueName}</strong>, you might consider talking to a {e.categories.join(" or ")} professional. {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {/* 7. Parent inputs */}
      <Section
        id="inputs"
        title="Parent inputs"
        intro={
          parentInputs.latestSetAt
            ? `Ratings from ${parentInputs.raterName ?? "a parent"} on ${fmtDate(parentInputs.latestSetAt)}${parentInputs.previousSetAt ? `, next to the earlier set from ${fmtDate(parentInputs.previousSetAt)}` : ""}. Ratings are 1 to 5; they are read-only here.`
            : "No parent ratings have been entered yet."
        }
      >
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Parent ratings and marks next to the child&apos;s scores</caption>
            <thead className="bg-muted text-xs">
              <tr>
                <th scope="col" className="p-2.5">Virtue</th>
                <th scope="col" className="p-2.5">Parent rating</th>
                <th scope="col" className="p-2.5">Mark</th>
                <th scope="col" className="p-2.5">Child&apos;s score</th>
                <th scope="col" className="p-2.5">Teacher</th>
                <th scope="col" className="p-2.5">Earlier set</th>
                <th scope="col" className="p-2.5">What changed</th>
              </tr>
            </thead>
            <tbody>
              {parentInputs.rows.map((r) => {
                const v = report.virtues.find((x) => x.virtueId === r.virtueId)!;
                return (
                  <tr key={r.virtueId} className="border-t align-top">
                    <th scope="row" className="p-2.5 font-medium">{r.name}</th>
                    <td className="p-2.5">{r.latest ? `${r.latest.rating} / 5` : "—"}</td>
                    <td className="p-2.5">{r.latest ? <Mark mark={r.latest.mark} /> : "—"}</td>
                    <td className="p-2.5">{v.confidence === "insufficient" || v.child === null ? "Not enough data yet" : Math.round(v.child)}</td>
                    <td className="p-2.5">{r.teacherRating ? `${r.teacherRating} / 5` : "—"}</td>
                    <td className="p-2.5">{r.previous ? `${r.previous.rating} / 5 · ` : "—"}{r.previous && <Mark mark={r.previous.mark} />}</td>
                    <td className="p-2.5">
                      {r.change ?? (r.previous ? "No change" : "—")}
                      {r.latest?.notes && <span className="mt-1 block text-xs text-muted-foreground">Note: &ldquo;{r.latest.notes}&rdquo;</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!learnedChange && parentInputs.previousSetAt && <p className="text-sm text-muted-foreground">Nothing has changed between the two sets.</p>}
      </Section>

      {/* 8. Trend over time */}
      <Section id="trend" title="Trend over time" intro="Pick a virtue to see its running score after each finished story, with dates.">
        <div className="print:hidden">
          <TrendExplorer virtues={trendVirtues} />
        </div>
        <div className="hidden space-y-1 text-sm print:block">
          {report.virtues.map((v) => (
            <p key={v.virtueId}>
              <strong>{v.name}:</strong> {v.series.length === 0 ? "no scored stories yet" : v.series.map((p) => `${Math.round(p.score)} (${fmtDate(p.at)})`).join(" → ")}
            </p>
          ))}
        </div>
      </Section>

      {/* 9. Access log */}
      <Section id="log" title="Who viewed this report" intro="Every time this report is opened or printed, it is written here. No IP address is stored.">
        <ul className="divide-y rounded-xl border text-sm">
          {access.map((a, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-3 py-2">
              <span>
                {a.actorName} · {a.action === "REPORT_VIEW" ? "viewed the report" : "printed or saved the report"}
              </span>
              <span className="text-muted-foreground">{fmtDateTime(a.at)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="border-t pt-4 text-xs text-muted-foreground">
        {report.disclaimer} Scoring rules {report.ruleVersion}, as of {fmtDate(report.asOf)}.
      </p>
    </div>
  );
}
