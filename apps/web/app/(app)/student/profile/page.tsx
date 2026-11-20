import { AwardIcon, BookOpenCheckIcon, ShieldCheckIcon, StarIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AvatarBubble } from "@/components/student/AvatarBubble";
import { AvatarPicker } from "@/components/student/AvatarPicker";
import { StudentSkeleton } from "@/components/student/StudentSkeleton";
import { requireStudent } from "@/lib/auth/server";
import { getStudentProfile } from "@/lib/learning/overview";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return (
    <Suspense fallback={<StudentSkeleton label="Loading your profile" />}>
      <Profile />
    </Suspense>
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <li className="flex flex-col items-center gap-1 rounded-3xl border-2 bg-card p-4 text-center">
      <Icon className="size-6 text-primary" aria-hidden />
      <span className="text-3xl font-extrabold">{value}</span>
      <span className="text-base text-muted-foreground">{label}</span>
    </li>
  );
}

async function Profile() {
  const user = await requireStudent();
  const data = await getStudentProfile(user.id);
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header className="flex items-center gap-4">
        <AvatarBubble avatar={data.avatar} name={data.name} className="size-20 text-5xl" />
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-extrabold tracking-tight" data-testid="profile-name">
            {data.name}
          </h1>
          {data.username && <p className="text-lg text-muted-foreground">@{data.username}</p>}
        </div>
      </header>

      <section aria-labelledby="avatar-heading" className="space-y-3">
        <h2 id="avatar-heading" className="text-2xl font-bold">
          Pick your avatar
        </h2>
        <AvatarPicker current={data.avatar} />
      </section>

      <section aria-labelledby="stats-heading" className="space-y-3">
        <h2 id="stats-heading" className="text-2xl font-bold">
          Your adventure so far
        </h2>
        <ul className="grid grid-cols-3 gap-3">
          <Stat icon={BookOpenCheckIcon} value={data.storiesFinished} label={data.storiesFinished === 1 ? "story" : "stories"} />
          <Stat icon={StarIcon} value={data.totalStars} label={data.totalStars === 1 ? "star" : "stars"} />
          <Stat icon={AwardIcon} value={data.badgeCount} label={data.badgeCount === 1 ? "badge" : "badges"} />
        </ul>
      </section>

      <section className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/student/parent" className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-muted-foreground underline-offset-4 hover:underline">
          <ShieldCheckIcon className="size-5" aria-hidden /> For grown-ups
        </Link>
        <LogoutButton buttonClassName="min-h-12 rounded-2xl px-6 text-base" />
      </section>
    </div>
  );
}
