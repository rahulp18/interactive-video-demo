import { UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <StudentPlaceholder title="Profile" description="All about you." icon={UserRoundIcon} />;
}
