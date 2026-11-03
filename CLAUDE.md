# interactive-video-demo

Interactive video platform: videos with timed interactions (SURVEY / QUIZ questions that appear at a timestamp). Web app + mobile app share one Postgres backend and one shared TS package.

## Layout (pnpm + Turborepo monorepo)
- `apps/web` — Next.js 16 (App Router, React 19.3, Tailwind 4, Turbopack). Also hosts the backend: Prisma DB access in `apps/web/prisma/`.
- `apps/mobile` — Expo SDK 58 / React Native 0.88, Expo Router (routes in `src/app/`).
- `packages/shared` — `@demo/shared`, plain TS source (no build step; `main` points at `src/index.ts`). Web consumes it via `transpilePackages`.

## Commands (run from repo root)
- `pnpm dev:web` / `pnpm dev:mobile`
- `pnpm typecheck` (turbo) — run before calling a task done. `pnpm build` for builds.
- Web only: `pnpm --filter web lint`, `pnpm --filter web contract:emit` (regenerate Prisma contract after editing `contract.prisma`).
- Package manager is pnpm 11; never use npm/yarn. In mobile, add deps with `npx expo install`.

## Critical gotchas
- **Next.js 16 and Expo 58 differ from training data.** Before writing code against them, follow `apps/web/AGENTS.md` (read `apps/web/node_modules/next/dist/docs/`) and `apps/mobile/AGENTS.md` (fetch versioned Expo docs). Those files load automatically when you work in those dirs.
- **Prisma 8 (rc) with `@prisma/orm-postgres`**, not the classic Prisma Client. Schema is `apps/web/prisma/contract.prisma`; generated `contract.json`/`contract.d.ts` are committed outputs. Prisma skills live in `apps/web/.claude/skills/`. Don't assume classic `schema.prisma` APIs.
- Secrets: `apps/web/.env` (see `.env.example`). Never print or commit it.
- Not a git repo yet (as of 2026-11-03) — no history to consult; don't run git commands expecting results.

## Project memory (how to behave like a teammate who remembers)
Always-loaded: this file (keep < 100 lines). On-demand long-term memory in `.claude/memory/`:
- `architecture.md` — how the pieces fit (auth, data flow, conventions). Read when a task touches those areas.
- `decisions.md` — dated log of important decisions and WHY. Read before changing anything it may cover.

**Read first, explore second:** before scanning the repo for orientation, check this file and `.claude/memory/`. Only explore code for details they don't cover.

**What to save (rarely):** a decision with a non-obvious reason, a convention that isn't visible from code, a hard-won gotcha, a change in architecture. Append to `decisions.md` (one entry: date, decision, why, consequences) or update `architecture.md`.
**What NOT to save:** routine tasks, bug fixes, anything derivable from code/schema, step-by-step history, temporary state.
**Keep it true:** if you find a memory stale or wrong, fix or delete it in the same task. Prefer editing an existing entry over adding. Tell the user in one line when you update memory.
**Personal preferences** go in `CLAUDE.local.md` (gitignored) or the user's auto memory, not here.

Path-scoped rules in `.claude/rules/` load automatically when relevant files are touched (e.g. `database.md` for Prisma/migrations).
