# Decisions log

Append-only, newest at bottom. Only decisions with a non-obvious WHY. Format:
`## YYYY-MM-DD — Title` / Decision / Why / Consequences.

## 2026-11-03 — Monorepo with pnpm + Turborepo
Decision: `apps/web`, `apps/mobile`, `packages/shared`.
Why: web and mobile share types/logic and one backend.
Consequences: shared package ships raw TS (no build); consumers must transpile it.

## 2026-11-03 — Single Session table for web cookies and mobile bearer tokens
Decision: store only SHA-256 of the token in `Session.tokenHash`.
Why: one auth mechanism for both clients; DB leak doesn't expose usable tokens.
Consequences: tokens can't be recovered; revocation = delete row.

## 2026-11-03 — Integrity rules live in Postgres
Decision: CHECK constraints and composite FKs (e.g. response's selected option must belong to its interaction).
Why: guarantees hold regardless of which client/code path writes.
Consequences: schema changes need migrations; app code should surface constraint errors gracefully.

## 2026-11-03 — Web auth UI: server-rendered pages, session read on the server, shadcn/ui
Decision: pages are server components; only forms (`components/auth/*Form.tsx`) and `LogoutButton` are client. Protected/guest gating reads the HttpOnly cookie on the server (`lib/auth/server.ts` → `validateSession`) inside `<Suspense>` (required by `cacheComponents`). No client-side auth context. UI uses shadcn/ui (`base-nova`, neutral) in `components/ui/`.
Why: no auth flash, no tokens in JS, and calling our own `/api/auth/me` over HTTP from a server component is wasteful. Do NOT cache the user (`use cache: private`): logout/revocation must apply immediately.
Consequences: `/api/auth/register` now also signs the user in (cookie for web, raw token for mobile, same as login). Session is an opaque revocable token, not a JWT. shadcn CLI generated a bogus `cn` npm dep/import; replaced with clsx + tailwind-merge in `lib/utils.ts`. Vitest inlines `next` so `vi.mock("next/server")` works.
