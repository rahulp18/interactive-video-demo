import { HouseIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "Home" };

export default function Page() {
  return <StudentPlaceholder title="Home" description="Your PARICHAY home." icon={HouseIcon} />;
}
