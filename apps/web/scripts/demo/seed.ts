import "dotenv/config";
import { confirmTarget, demoPassword } from "./guard";
import { demoAccountIds, ensureAccounts, hasHistory, seedContent, seedJourneys, seedStudentHistory } from "./seed-lib";
import { printSummary } from "./summary";
import { db } from "../../prisma/db";

// `pnpm --filter web seed:demo --yes [--set-password]`
// Creates or updates the PARICHAY demo content, accounts and the demo student's history. Idempotent.
async function main() {
  const argv = process.argv.slice(2);
  confirmTarget(argv, "PARICHAY demo seed");
  const password = demoPassword();

  const ids = await ensureAccounts(password, { syncPasswords: argv.includes("--set-password") });
  console.log("accounts: ok (content team, student, fresh student)");

  const content = await seedContent(ids.content);
  console.log(`content: created ${content.stats.created}, updated ${content.stats.updated}, deleted ${content.stats.deleted}`);
  const journeys = await seedJourneys(content.moduleIds);
  console.log(`journeys: created ${journeys.created}, updated ${journeys.updated}, deleted ${journeys.deleted}`);

  if (await hasHistory(ids.student)) {
    console.log("history: the demo student already has history, left as is (run `pnpm --filter web demo:reset --yes` to restore it)");
  } else {
    const h = await seedStudentHistory(ids.student);
    console.log(`history: ${h.progress} module progress rows, ${h.responses} responses, ${h.ratings} ratings`);
  }

  console.log("\nWatch links (sign in as the demo student first):");
  for (const [slug, shareId] of Object.entries(content.shareIds)) console.log(`  /watch/${shareId}   ${slug}`);
  await printSummary((await demoAccountIds()).student);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.close?.());
