import type { Metadata } from "next";
import { InteractionsPage } from "@/components/interactions/InteractionsView";

export const metadata: Metadata = { title: "Surveys" };

export default function SurveysPage({ searchParams }: PageProps<"/surveys">) {
  return <InteractionsPage type="SURVEY" searchParams={searchParams} />;
}
