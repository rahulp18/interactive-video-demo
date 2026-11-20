import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { SignIn } from "@/components/auth/SignIn";
import { redirectIfAuthenticated } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign in" };

async function GuestOnly({ next, children }: { next: Promise<string | undefined>; children: ReactNode }) {
  await redirectIfAuthenticated(await next);
  return children;
}

// `?next=` is a single string or, if repeated, an array; only a lone string is meaningful.
const nextParam = async (searchParams: PageProps<"/login">["searchParams"]) => {
  const value = (await searchParams).next;
  return typeof value === "string" ? value : undefined;
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const card = (
    <AuthCard
      title="Welcome back"
      description="Sign in to pick up where you left off."
      panelTitle="Good to see you again."
      panelText="Pick up where you left off. Your answers are saved to your account."
    >
      <SignIn />
    </AuthCard>
  );
  // The form is the static shell; the session check streams in behind it and redirects signed-in visitors.
  return (
    <Suspense fallback={card}>
      <GuestOnly next={nextParam(searchParams)}>{card}</GuestOnly>
    </Suspense>
  );
}
