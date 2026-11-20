import { FileTextIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "My Reports" };

export default function Page() {
  return <StudentPlaceholder title="My Reports" description="Reports on your learning and development." icon={FileTextIcon} />;
}
