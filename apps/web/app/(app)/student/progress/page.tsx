import { ChartLineIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "My Progress" };

export default function Page() {
  return <StudentPlaceholder title="My Progress" description="See how you are growing over time." icon={ChartLineIcon} />;
}
