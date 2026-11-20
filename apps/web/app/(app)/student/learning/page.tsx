import { BookOpenIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "My Learning" };

export default function Page() {
  return <StudentPlaceholder title="My Learning" description="Pick up where you left off." icon={BookOpenIcon} />;
}
