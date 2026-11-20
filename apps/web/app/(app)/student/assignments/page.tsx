import { ClipboardCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "My Assignments" };

export default function Page() {
  return <StudentPlaceholder title="My Assignments" description="Work set for you by your teachers." icon={ClipboardCheckIcon} />;
}
