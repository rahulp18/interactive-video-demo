import { AwardIcon, LockIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentSkeleton } from "@/components/student/StudentSkeleton";
import { VirtueIcon } from "@/components/student/VirtueChip";
import { VirtueTree } from "@/components/student/tree/VirtueTree";
import { requireStudent } from "@/lib/auth/server";
import { getVirtueTree } from "@/lib/learning/overview";
import { virtueDisplay, virtueTint } from "@/lib/virtues/display";

export const metadata: Metadata = { title: "My Virtue Tree" };

export default function Page() {
  return (
    <Suspense fallback={<StudentSkeleton label="Loading your tree" />}>
      <Tree />
    </Suspense>
  );
}

const STAGE_WORDS = {
  sapling: "Your tree is just starting to grow!",
  young: "Your tree is growing tall!",
  full: "Look at your big, beautiful tree!",
} as const;

async function Tree() {
  const user = await requireStudent();
  const data = await getVirtueTree(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">My Virtue Tree</h1>
        <p className="mt-1 text-lg text-muted-foreground">{STAGE_WORDS[data.stage]} Every story helps it grow.</p>
      </header>

      <section aria-label="Your tree" className="mx-auto w-full max-w-lg rounded-3xl border-2 bg-card p-4">
        <VirtueTree stage={data.stage} branches={data.branches} />
      </section>

      <section aria-labelledby="super-heading" className="space-y-3" data-testid="superpowers">
        <h2 id="super-heading" className="text-2xl font-bold">
          Your superpowers
        </h2>
        {data.superpowers.length === 0 ? (
          <p className="text-lg text-muted-foreground">Finish a story and your first superpower will show up here!</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.superpowers.map((s) => {
              const v = virtueDisplay(s.slug, s.name);
              return (
                <li key={s.slug} className="flex items-center gap-4 rounded-3xl border-2 p-4" style={virtueTint(v.color, 14)}>
                  <VirtueIcon slug={s.slug} className="size-14" />
                  <div>
                    <p className="text-lg font-bold">{v.name} Superpower!</p>
                    <p className="text-base">You are great at this: {v.line.toLowerCase()}.</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="badge-heading" className="space-y-3" data-testid="badge-shelf">
        <h2 id="badge-heading" className="text-2xl font-bold">
          Your badges
        </h2>
        {data.badges.length === 0 && <p className="text-lg text-muted-foreground">Your first badge is waiting. Finish a story to win it!</p>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.badges.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-lg font-semibold text-accent-foreground" data-testid="badge">
              <AwardIcon className="size-6 shrink-0" aria-hidden /> {b.title}
            </li>
          ))}
          {data.nextBadges.map((b) => (
            <li key={b.id} className="flex items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-3 text-lg text-muted-foreground" data-testid="next-badge">
              <LockIcon className="size-6 shrink-0" aria-hidden />
              <span>
                {b.title} <span className="font-semibold">Keep going!</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="virtues-heading" className="space-y-3" data-testid="virtue-list">
        <h2 id="virtues-heading" className="text-2xl font-bold">
          The 10 virtues
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {data.branches.map((b) => {
            const v = virtueDisplay(b.slug, b.name);
            return (
              <li key={b.slug} className="flex items-start gap-3 rounded-3xl border bg-card p-4" data-testid="virtue-item">
                <VirtueIcon slug={b.slug} className="size-12" />
                <div>
                  <h3 className="text-lg font-bold">{v.name}</h3>
                  <p className="text-base text-muted-foreground">{v.explain}</p>
                  <p className="mt-1 text-sm font-semibold text-primary">Ready to grow!</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
