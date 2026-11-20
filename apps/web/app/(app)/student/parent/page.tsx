import { ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/StudentPlaceholder";

export const metadata: Metadata = { title: "For grown-ups" };

// Placeholder until Phase 6 (parent preview, and whether it needs a parental gate). Same student guard as every page.
export default function Page() {
  return <StudentPlaceholder title="For grown-ups" description="A page for parents and carers." icon={ShieldCheckIcon} />;
}
