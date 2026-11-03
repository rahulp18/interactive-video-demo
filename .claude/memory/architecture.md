# Architecture memory

_Last verified: 2026-11-03. Update when reality changes; delete what's wrong._

## Shape
- Monorepo: `apps/web` (Next.js 16 + backend), `apps/mobile` (Expo 58), `packages/shared` (`@demo/shared`, source-only TS).
- Next config: `cacheComponents: true`, `partialPrefetching: true`, Tailwind 4 via `@tailwindcss/turbopack`, `transpilePackages: ["@demo/shared"]`.
- Current state: auth backend + web auth UI (/login, /register, /dashboard) done; videos/interactions not started. Mobile is still template screens.

## Details verified by reading code (2026-11-03)
- Web: `app/page.tsx` is a placeholder (`HomePage`), `layout.tsx` still has create-next-app metadata/Geist fonts. Path alias `@/*` → `apps/web/*`. ESLint = `eslint-config-next` core-web-vitals + typescript.
- Mobile: tab layout (`app-tabs`, with `.web.tsx` variants), `@/` alias into `src/`, `reactCompiler` and `typedRoutes` enabled, `web.output: "server"`. Home screen already imports `demoChapters`/`formatTimestamp` from `@demo/shared` (proves the shared wiring works). Platform-specific files use `.web.ts(x)` suffix.
- TS: `tsconfig.base.json` (strict, Bundler resolution) at root; TypeScript ~6.0.
- Migrations so far (`apps/web/migrations/app/`): `20261103T0921_init_interactive_video_schema`, `20261103T0929_add_session`. Snapshots in `migrations/snapshots/` — generated, don't hand-edit.
- Skills for Prisma live in `apps/web/.claude/skills/` (mirrored in `.agents/skills/`).

## Auth design (from schema)
- One `Session` table serves both clients: web uses a cookie, mobile a bearer token. Only the SHA-256 of the token is stored; passwords are hashed in application code.

## Conventions
- Match existing style: web uses `@/` alias; mobile uses `@/` → `src/`; platform splits via `.web.tsx`.
- Shared logic/types used by both apps go in `packages/shared`.
- DB invariants enforced in Postgres (CHECKs, composite FKs).

## Open questions (fill in as decided; move answers to decisions.md)
- Video storage/hosting for `Video.fileUrl`.
- Test setup (vitest is installed in web, no tests yet).
- Deployment target.
