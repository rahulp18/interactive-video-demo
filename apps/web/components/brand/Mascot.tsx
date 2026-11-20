import { cn } from "@/lib/utils";

/**
 * "Pari", the PARICHAY mascot: a round, smiling friend with a sprout on top (the virtue tree starts small) waving hello.
 * Pure SVG on theme tokens, so it follows light/dark. Decorative: hidden from assistive tech.
 */
export function Mascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden className={cn("size-full", className)}>
      {/* sprout */}
      <path d="M100 52 C100 38 98 30 94 24" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-(--student-leaf)" />
      <path d="M95 30 C80 28 70 18 68 8 C82 8 94 16 95 30Z" className="fill-(--student-leaf)" />
      <path d="M97 36 C112 36 124 26 126 14 C110 14 98 24 97 36Z" className="fill-(--student-leaf)" opacity=".8" />
      {/* waving arm */}
      <g className="origin-[160px_120px] motion-safe:animate-[wave_2.2s_ease-in-out_infinite]">
        <path d="M156 118 C176 108 184 90 178 74" fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-primary" />
        <circle cx="178" cy="72" r="10" className="fill-primary" />
      </g>
      <path d="M44 118 C24 124 18 138 22 150" fill="none" strokeWidth="14" strokeLinecap="round" className="stroke-primary" />
      {/* body */}
      <ellipse cx="100" cy="124" rx="62" ry="58" className="fill-primary" />
      <ellipse cx="100" cy="134" rx="42" ry="38" className="fill-primary-foreground" opacity=".95" />
      {/* feet */}
      <ellipse cx="74" cy="182" rx="20" ry="9" className="fill-foreground" opacity=".85" />
      <ellipse cx="126" cy="182" rx="20" ry="9" className="fill-foreground" opacity=".85" />
      {/* face */}
      <g className="motion-safe:animate-[blink_5s_infinite]" style={{ transformOrigin: "100px 112px" }}>
        <circle cx="80" cy="112" r="9" className="fill-foreground" />
        <circle cx="120" cy="112" r="9" className="fill-foreground" />
        <circle cx="83" cy="108" r="3" className="fill-background" />
        <circle cx="123" cy="108" r="3" className="fill-background" />
      </g>
      <circle cx="64" cy="132" r="7" className="fill-accent" />
      <circle cx="136" cy="132" r="7" className="fill-accent" />
      <path d="M84 134 C90 150 110 150 116 134Z" strokeWidth="4" strokeLinejoin="round" className="fill-background stroke-foreground" />
    </svg>
  );
}
