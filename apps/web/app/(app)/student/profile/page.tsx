import { UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "My Profile" };

export default function Page() {
  return <StudentPlaceholder title="My Profile" description="Your account details." icon={UserRoundIcon} />;
}
