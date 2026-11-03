import type { Metadata } from "next";
import { InteractionsPage } from "@/components/interactions/InteractionsView";

export const metadata: Metadata = { title: "Quizzes" };

export default function QuizzesPage({ searchParams }: PageProps<"/quizzes">) {
  return <InteractionsPage type="QUIZ" searchParams={searchParams} />;
}
