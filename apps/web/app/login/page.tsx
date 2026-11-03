import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/LoginForm";
import { redirectIfAuthenticated } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Log in" };

async function GuestOnly({ children }: { children: ReactNode }) {
  await redirectIfAuthenticated();
  return children;
}

export default function LoginPage() {
  const card = (
    <AuthCard title="Welcome back" description="Log in to your account.">
      <LoginForm />
    </AuthCard>
  );
  // The form is the static shell; the session check streams in behind it and redirects signed-in visitors.
  return (
    <Suspense fallback={card}>
      <GuestOnly>{card}</GuestOnly>
    </Suspense>
  );
}
