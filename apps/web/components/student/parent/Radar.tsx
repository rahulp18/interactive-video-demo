"use client";

import { useState } from "react";
import { SERIES, type SeriesKey } from "./format";

export type RadarAxis = {
  slug: string;
  name: string;
  /** null = "not enough data yet": drawn as an empty (hollow) axis, never as 0. */
  composite: number | null;
  parent: number | null;
  teacher: number | null;
  insufficient: boolean;
};

const SIZE = 440;
const C = SIZE / 2;
const R = 140;

const point = (i: number, n: number, value: number) => {
  const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
  const r = (value / 100) * R;
  return [C + Math.cos(angle) * r, C + Math.sin(angle) * r] as const;
};

/** Closed shape through the axes that have a value. Axes without a value are skipped, not set to 0. */
function shape(axes: readonly RadarAxis[], pick: (a: RadarAxis) => number | null) {
  const pts = axes.flatMap((a, i) => {
    const v = pick(a);
    return v === null ? [] : [point(i, axes.length, v)];
  });
  return pts;
}

function Marker({ kind, x, y, color }: { kind: string; x: number; y: number; color: string }) {
  if (kind === "square") return <rect x={x - 3.5} y={y - 3.5} width={7} height={7} fill={color} />;
  if (kind === "triangle") return <polygon points={`${x},${y - 4.5} ${x + 4.5},${y + 3.5} ${x - 4.5},${y + 3.5}`} fill={color} />;
  return <circle cx={x} cy={y} r={3.5} fill={color} />;
}

/**
 * 10-axis radar (FR-6.12). The overall score is the main shape; parent and teacher views are overlays the reader can
 * switch on and off. A table alternative is always in the page for screen readers and print.
 */
export function Radar({ axes }: { axes: RadarAxis[] }) {
  const [show, setShow] = useState<Record<"parent" | "teacher", boolean>>({ parent: false, teacher: false });
  const n = axes.length;
  const layers: { key: SeriesKey; pick: (a: RadarAxis) => number | null; on: boolean }[] = [
    { key: "composite", pick: (a) => (a.insufficient ? null : a.composite), on: true },
    { key: "parent", pick: (a) => a.parent, on: show.parent },
    { key: "teacher", pick: (a) => a.teacher, on: show.teacher },
  ];
  const summary = axes.map((a) => `${a.name} ${a.insufficient || a.composite === null ? "not enough data yet" : Math.round(a.composite)}`).join(", ");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" role="group" aria-label="Choose which views to draw">
        <span className="inline-flex items-center gap-2 font-medium">
          <svg width="28" height="10" aria-hidden>
            <line x1="0" y1="5" x2="28" y2="5" stroke="currentColor" strokeWidth="3" />
          </svg>
          Overall (always shown)
        </span>
        {(["parent", "teacher"] as const).map((k) => (
          <label key={k} className="inline-flex min-h-11 cursor-pointer items-center gap-2">
            <input type="checkbox" className="size-4" checked={show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} />
            <svg width="28" height="10" aria-hidden>
              <line x1="0" y1="5" x2="28" y2="5" stroke={SERIES[k].color} strokeWidth="2.5" strokeDasharray={SERIES[k].dash} />
            </svg>
            {SERIES[k].label} view
          </label>
        ))}
      </div>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Radar chart of ten virtues. ${summary}.`} className="mx-auto mt-2 block h-auto w-full max-w-[34rem]">
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={axes.map((_, i) => point(i, n, ring).join(",")).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={ring === 100 ? 0.35 : 0.15}
          />
        ))}
        {axes.map((a, i) => {
          const [x, y] = point(i, n, 100);
          const [lx, ly] = point(i, n, 122);
          const anchor = lx < C - 8 ? "end" : lx > C + 8 ? "start" : "middle";
          return (
            <g key={a.slug}>
              <line x1={C} y1={C} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.2} strokeDasharray={a.insufficient ? "3 4" : undefined} />
              {a.insufficient && <circle cx={x} cy={y} r={5} fill="var(--background)" stroke="currentColor" strokeWidth={1.5} strokeDasharray="2 2" />}
              <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize={12} fill="currentColor" fontWeight={500}>
                {a.name}
                {a.insufficient && (
                  <tspan x={lx} dy={13} fontSize={10.5} fontWeight={400} fillOpacity={0.7}>
                    not enough data yet
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
        {layers
          .filter((l) => l.on)
          .map(({ key, pick }) => {
            const pts = shape(axes, pick);
            if (pts.length === 0) return null;
            const s = SERIES[key];
            const d = pts.map((p) => p.join(",")).join(" ");
            return (
              <g key={key}>
                {pts.length > 2 && (
                  <polygon points={d} fill={s.color} fillOpacity={key === "composite" ? 0.14 : 0.06} stroke={s.color} strokeWidth={key === "composite" ? 2.5 : 2} strokeDasharray={s.dash} strokeLinejoin="round" />
                )}
                {pts.length === 2 && <polyline points={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />}
                {pts.map(([x, y], i) => (
                  <Marker key={i} kind={s.marker} x={x} y={y} color={s.color} />
                ))}
              </g>
            );
          })}
      </svg>

      {/* Table alternative: for screen readers, and shown in print. */}
      <table className="sr-only print:not-sr-only print:mt-3 print:w-full print:text-xs">
        <caption className="text-left font-medium">The same radar as a table (scores out of 100)</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left">Virtue</th>
            <th scope="col" className="text-left">Overall</th>
            <th scope="col" className="text-left">Parent view</th>
            <th scope="col" className="text-left">Teacher view</th>
          </tr>
        </thead>
        <tbody>
          {axes.map((a) => (
            <tr key={a.slug}>
              <th scope="row" className="text-left font-normal">{a.name}</th>
              <td>{a.insufficient || a.composite === null ? "Not enough data yet" : Math.round(a.composite)}</td>
              <td>{a.parent === null ? "No rating" : Math.round(a.parent)}</td>
              <td>{a.teacher === null ? "No rating" : Math.round(a.teacher)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
