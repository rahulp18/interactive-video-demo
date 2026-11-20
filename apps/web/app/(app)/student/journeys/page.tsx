import { CompassIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "Journeys" };

export default function Page() {
  return <StudentPlaceholder title="Journeys" description="Stories to watch and think about." icon={CompassIcon} />;
}
