import { SproutIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "My Virtue Tree" };

export default function Page() {
  return <StudentPlaceholder title="My Virtue Tree" description="Watch your tree grow." icon={SproutIcon} />;
}
