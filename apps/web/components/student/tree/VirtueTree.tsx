import { hasBlossom, leavesFor, MAX_LEAVES } from "@/lib/learning/overview-rules";
import type { TreeBranch, TreeStage } from "@/lib/learning/overview-types";
import { virtueDisplay } from "@/lib/virtues/display";
import { cn } from "@/lib/utils";

// A tree drawn in code. The WHOLE tree grows with total stars (sapling -> young -> full). Each of the ten branches
// belongs to one virtue, in the fixed virtue order, and shows leaves for that virtue's stars, plus a bud at its tip
// ALWAYS, so no branch ever looks empty. There are no numbers or labels on the branches and nothing is ranked.

const SCALE: Record<TreeStage, number> = { sapling: 0.62, young: 0.84, full: 1 };
const GROUND_Y = 392;

type Pt = { x: number; y: number };

/** Branch i sits on the trunk, alternating left and right, climbing up. Quadratic curve; returns point + direction at t. */
function branchGeometry(i: number) {
  const side = i % 2 === 0 ? -1 : 1;
  const y = 340 - i * 21;
  const length = 100 - i * 4.5;
  const p0: Pt = { x: 200, y };
  const p1: Pt = { x: 200 + side * length * 0.6, y: y - 4 };
  const p2: Pt = { x: 200 + side * length, y: y - 36 };
  const at = (t: number) => {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
      // derivative -> angle of the branch at t, so leaves lean the way the branch grows
      angle: (Math.atan2(2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y), 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x)) * 180) / Math.PI,
    };
  };
  return { side, p0, p1, p2, at, d: `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}` };
}

function Branch({ branch, index, animate }: { branch: TreeBranch; index: number; animate: boolean }) {
  const { color } = virtueDisplay(branch.slug);
  const g = branchGeometry(index);
  const leaves = leavesFor(branch.stars);
  const tip = g.at(1);
  const grow = animate ? "motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-both" : "";
  return (
    <g data-testid="tree-branch" data-virtue={branch.slug}>
      <path d={g.d} fill="none" stroke="var(--student-trunk)" strokeWidth={5 - index * 0.25} strokeLinecap="round" />
      {Array.from({ length: leaves }, (_, k) => {
        const t = 0.22 + (k * 0.7) / MAX_LEAVES;
        const p = g.at(t);
        const flip = k % 2 === 0 ? -1 : 1;
        return (
          <ellipse
            key={k}
            data-testid="tree-leaf"
            cx={p.x}
            cy={p.y + flip * 7}
            rx={9}
            ry={4.6}
            transform={`rotate(${p.angle + flip * 40} ${p.x} ${p.y + flip * 7})`}
            fill="var(--student-leaf)"
            stroke="var(--card)"
            strokeWidth={1}
            className={grow}
            style={{ animationDelay: `${index * 60 + k * 90}ms`, animationDuration: "700ms" }}
          />
        );
      })}
      {hasBlossom(branch.stars) ? (
        <g data-testid="tree-blossom" className={grow} style={{ animationDelay: `${index * 60 + 600}ms`, animationDuration: "900ms" }}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <circle key={deg} cx={tip.x + 6.5 * Math.cos((deg * Math.PI) / 180)} cy={tip.y + 6.5 * Math.sin((deg * Math.PI) / 180)} r={4.6} fill={color} stroke="var(--card)" strokeWidth={1} />
          ))}
          <circle cx={tip.x} cy={tip.y} r={3.4} fill="var(--card)" stroke={color} strokeWidth={1.5} />
        </g>
      ) : (
        <circle data-testid="tree-bud" cx={tip.x} cy={tip.y} r={5.5} fill={color} stroke="var(--card)" strokeWidth={1.5} />
      )}
    </g>
  );
}

export function VirtueTree({ stage, branches, className, animate = true }: { stage: TreeStage; branches: TreeBranch[]; className?: string; animate?: boolean }) {
  const s = SCALE[stage];
  const label = {
    sapling: "Your virtue tree is a sapling, just starting to grow.",
    young: "Your virtue tree is a young tree, growing well.",
    full: "Your virtue tree is a big, full tree.",
  }[stage];
  return (
    <svg viewBox="0 0 400 420" role="img" aria-label={`${label} It has ten branches, one for each virtue, and every branch has something growing.`} className={cn("h-auto w-full", className)} data-testid="virtue-tree" data-stage={stage}>
      <ellipse cx={200} cy={GROUND_Y + 6} rx={150} ry={16} fill="var(--muted)" />
      <g transform={`translate(200 ${GROUND_Y}) scale(${s}) translate(-200 -${GROUND_Y})`}>
        <g className="tree-sway">
          {stage !== "sapling" && <circle cx={200} cy={190} r={stage === "full" ? 150 : 120} fill="var(--student-leaf)" opacity={0.1} />}
          <path d={`M 190 ${GROUND_Y} C 194 360, 196 300, 197 130 L 203 130 C 204 300, 206 360, 210 ${GROUND_Y} Z`} fill="var(--student-trunk)" />
          {branches.map((b, i) => (
            <Branch key={b.slug} branch={b} index={i} animate={animate} />
          ))}
        </g>
      </g>
    </svg>
  );
}
