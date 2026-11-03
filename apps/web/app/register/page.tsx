import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { redirectIfAuthenticated } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Create account" };

async function GuestOnly({ children }: { children: ReactNode }) {
  await redirectIfAuthenticated();
  return children;
}

export default function RegisterPage() {
  const card = (
    <AuthCard title="Create your account" description="Sign up to get started.">
      <RegisterForm />
    </AuthCard>
  );
  return (
    <Suspense fallback={card}>
      <GuestOnly>{card}</GuestOnly>
    </Suspense>
  );
}
