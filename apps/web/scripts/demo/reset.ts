import "dotenv/config";
import { confirmTarget } from "./guard";
import { clearDemoLockouts, clearParentPreviewState, clearStudentHistory, demoAccountIds, resetStudent } from "./seed-lib";
import { printSummary } from "./summary";
import { db } from "../../prisma/db";

// `pnpm --filter web demo:reset --yes`   (run this before every demo)
// Deletes the demo student's progress, responses and ratings and re-creates the designed history relative to today
// (so the 90-day trend window lines up), clears the parent preview's access log and closes its grown-up gate, and empties the fresh student's history (that account must start brand new). Content and
// every other user are untouched; usernames, PINs and avatars are kept.
async function main() {
  confirmTarget(process.argv.slice(2), "PARICHAY demo reset");
  const ids = await demoAccountIds();
  await clearDemoLockouts(ids);
  const h = await resetStudent(ids.student);
  await clearStudentHistory(ids.fresh);
  await clearParentPreviewState(ids.fresh);
  console.log("sign-in lockouts cleared (usernames and PINs unchanged); the fresh student starts brand new");
  console.log(`reset: ${h.progress} module progress rows, ${h.responses} responses, ${h.ratings} ratings restored`);
  await printSummary(ids.student);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.close?.());
