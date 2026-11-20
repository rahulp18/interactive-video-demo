import { CompassIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "Explore Journeys" };

export default function Page() {
  return <StudentPlaceholder title="Explore Journeys" description="Discover guided learning journeys." icon={CompassIcon} libraryLink />;
}
