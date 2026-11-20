import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { redirectIfAuthenticated } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Create account" };

async function GuestOnly({ next, children }: { next: Promise<string | undefined>; children: ReactNode }) {
  await redirectIfAuthenticated(await next);
  return children;
}

// `?next=` is a single string or, if repeated, an array; only a lone string is meaningful.
const nextParam = async (searchParams: PageProps<"/register">["searchParams"]) => {
  const value = (await searchParams).next;
  return typeof value === "string" ? value : undefined;
};

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  const card = (
    <AuthCard
      title="Create your student account"
      description="It takes a minute. We only need your name, email and a password."
      panelTitle="Learn by watching, and by answering."
      panelText="Interactive videos pause at the right moments for a quiz or a quick survey, so you take part instead of just watching."
    >
      <RegisterForm />
    </AuthCard>
  );
  return (
    <Suspense fallback={card}>
      <GuestOnly next={nextParam(searchParams)}>{card}</GuestOnly>
    </Suspense>
  );
}
