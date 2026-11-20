import { getAssessment, getChildView } from "../../lib/scoring/service";
import { db } from "../../prisma/db";
import { describeProfile } from "./profile";
import { CLIPS } from "./content";

/** Prints the demo student's live assessment (from the DB, through the real service) plus the clip credits. */
export async function printSummary(studentId: number) {
  const assessment = await getAssessment(studentId);
  const child = await getChildView(studentId);
  const slugs = new Map((await db.orm.public.Virtue.all()).map((v) => [v.id, v.slug]));
  console.log("\nDemo student assessment (read from the database):");
  console.log(describeProfile(assessment, (id) => slugs.get(id) ?? String(id)).map((l) => "  " + l).join("\n"));
  console.log(`\nChild view: superpowers ${child.superpowers.map((s) => s.name).join(", ") || "-"}; ${child.badges.length} badges; ${child.stars.total} stars.`);
  const credits = [...new Set(Object.values(CLIPS).map((c) => `${c.attribution}, ${c.licence}`))];
  console.log("\nClip credits (show these wherever the demo videos are shown):");
  for (const c of credits) console.log("  " + c);
}
