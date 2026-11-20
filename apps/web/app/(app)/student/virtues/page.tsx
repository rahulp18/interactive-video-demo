import { GemIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "Virtue Profile" };

export default function Page() {
  return <StudentPlaceholder title="Virtue Profile" description="Understand your strengths and character virtues." icon={GemIcon} />;
}
