"use client";

import { useState } from "react";

export type TrendVirtue = {
  slug: string;
  name: string;
  insufficient: boolean;
  /** Oldest first. `label` is already formatted by the server. */
  points: { label: string; score: number; t: number }[];
};

const W = 480;
const H = 220;
const PAD = { l: 34, r: 14, t: 12, b: 26 };

/** Pick a virtue to see its running score after each finished story, as a line and a dated list. */
export function TrendExplorer({ virtues }: { virtues: TrendVirtue[] }) {
  const [slug, setSlug] = useState(virtues.find((v) => v.points.length > 0)?.slug ?? virtues[0]?.slug);
  const v = virtues.find((x) => x.slug === slug) ?? virtues[0];
  if (!v) return null;

  const ts = v.points.map((p) => p.t);
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const x = (t: number) => PAD.l + (t1 === t0 ? (W - PAD.l - PAD.r) / 2 : ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
  const y = (s: number) => PAD.t + (1 - s / 100) * (H - PAD.t - PAD.b);

  return (
    <div>
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
        Virtue
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="min-h-11 rounded-lg border bg-background px-3 text-base font-normal"
        >
          {virtues.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      {v.points.length === 0 ? (
        <p className="mt-4 rounded-lg bg-muted p-4 text-sm">No finished story has scored {v.name} yet, so there is no trend to show.</p>
      ) : (
        <>
          {v.insufficient && (
            <p className="mt-3 text-sm text-muted-foreground">
              Not enough data yet for {v.name}: treat these early points as a first impression, not a result.
            </p>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${v.name} score after each story: ${v.points.map((p) => `${p.label} ${Math.round(p.score)}`).join(", ")}`} className="mt-3 block h-auto w-full max-w-xl">
            {[0, 25, 50, 75, 100].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.15} />
                <text x={PAD.l - 6} y={y(g)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="currentColor" fillOpacity={0.7}>
                  {g}
                </text>
              </g>
            ))}
            <polyline points={v.points.map((p) => `${x(p.t)},${y(p.score)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" />
            {v.points.map((p, i) => (
              <circle key={i} cx={x(p.t)} cy={y(p.score)} r={4} fill="var(--background)" stroke="currentColor" strokeWidth={2.5} />
            ))}
            <text x={PAD.l} y={H - 6} fontSize={11} fill="currentColor" fillOpacity={0.7}>
              {v.points[0].label}
            </text>
            {v.points.length > 1 && (
              <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.7}>
                {v.points.at(-1)!.label}
              </text>
            )}
          </svg>
          <ol className="mt-3 grid max-w-xl gap-1 text-sm sm:grid-cols-2">
            {v.points.map((p, i) => (
              <li key={i} className="flex justify-between gap-3 rounded-md bg-muted px-3 py-1.5">
                <span>
                  After story {i + 1} · {p.label}
                </span>
                <span className="font-semibold tabular-nums">{Math.round(p.score)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
