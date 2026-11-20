# Architecture memory

_Last verified: 2026-11-03. Update when reality changes; delete what's wrong._

## Shape
- Monorepo: `apps/web` (Next.js 16 + backend), `apps/mobile` (Expo 58), `packages/shared` (`@demo/shared`, source-only TS).
- Next config: `cacheComponents: true`, `partialPrefetching: true`, Tailwind 4 via `@tailwindcss/turbopack`, `transpilePackages: ["@demo/shared"]`.
- Current state (2026-11-20): auth + roles, video upload, the teacher web UI (dashboard, upload, My Videos, editor, Surveys, Quizzes, Responses, Settings), public playback (`/watch`), Library, and a PARICHAY landing page at `/` (public) are done. Student shell exists (nav: Home `/home`, Library, My Results `/results` = placeholder); student results/progress are not built. Mobile is still template screens.

## Details verified by reading code (2026-11-03)
- Web: `app/page.tsx` is the public PARICHAY landing (Student/Teacher entry -> `/login?next=/library|/dashboard`), `layout.tsx` has PARICHAY metadata (title template `%s | PARICHAY`). Path alias `@/*` → `apps/web/*`. ESLint = `eslint-config-next` core-web-vitals + typescript.
- Mobile: tab layout (`app-tabs`, with `.web.tsx` variants), `@/` alias into `src/`, `reactCompiler` and `typedRoutes` enabled, `web.output: "server"`. Home screen already imports `demoChapters`/`formatTimestamp` from `@demo/shared` (proves the shared wiring works). Platform-specific files use `.web.ts(x)` suffix.
- TS: `tsconfig.base.json` (strict, Bundler resolution) at root; TypeScript ~6.0.
- Migrations so far (`apps/web/migrations/app/`): `20261103T0921_init_interactive_video_schema`, `20261103T0929_add_session`. Snapshots in `migrations/snapshots/` — generated, don't hand-edit.
- Skills for Prisma live in `apps/web/.claude/skills/` (mirrored in `.agents/skills/`).

## Auth design (from schema)
- One `Session` table serves both clients: web uses a cookie, mobile a bearer token. Only the SHA-256 of the token is stored; passwords are hashed in application code.

## Roles (STUDENT / TEACHER)
- `User.role` (enum `UserRole`, default STUDENT). Rules live in ONE pure module, `lib/auth/roles.ts`: `homePathFor` (STUDENT `/library`, TEACHER `/dashboard`), `TEACHER_ONLY` / `STUDENT_ONLY` path prefixes, `canAccessPath`, `postAuthPath(role, next)` (validated `next` only if the role may open it, else home; decodes the path so `/%64ashboard` can't bypass). Shared routes: `/library`, `/settings`, `/watch/*`, auth pages.
- Server enforcement: pages call `requireTeacher()` / `requireStudent()` (`lib/auth/server.ts`, wrong role -> redirect to own home; every teacher page must call it itself); APIs use `handle(request, fn, { role: "TEACHER" })` or `requireRole(request, role)` (`lib/auth/request.ts`) -> 403 `FORBIDDEN`; UploadThing middleware requires TEACHER. New teacher-only page/route = add the guard AND the prefix in `roles.ts`. `/api/public/*` (answer) and `/library` stay role-agnostic.
- `redirectIfAuthenticated(next)` and the forms' `succeed(role)` both use `postAuthPath`. `AppFrame` takes `user.role` and picks `navItemsFor(role)`.
- Public registration always creates STUDENT (role set in `registerUser`, never read from the body). Teachers are granted out of band (SQL/admin), there is no UI for it yet.

## Video upload
- UploadThing (v7): route `app/api/uploadthing/{core,route}.ts`, policy in `lib/videos/policy.ts` (shared with browser), persistence `lib/videos/service.ts`, reusable client `components/videos/VideoUploader.tsx` (mounted on /dashboard for now).

## Web app structure (verified 2026-11-03)
- Authenticated pages live in route group `app/(app)/` (URLs: /dashboard /upload /videos /videos/[id] /surveys /quizzes /settings). `(app)/layout.tsx` wraps `AppShell` (session check + sidebar/top bar, `components/layout/`) in Suspense; each page ALSO calls `requireCurrentUser()` itself because layouts don't re-run on client navigation.
- Pages are server components that call services directly (`lib/videos/service.ts`, `lib/interactions/service.ts`); browser code calls the REST routes via `lib/videos/client.ts`. Pages read `params`/`searchParams` in an inner async component under `<Suspense>` (cacheComponents).
- API (all cookie-or-bearer authed via `lib/api/route.ts#handle`, errors use the auth error envelope): `GET /api/videos`, `GET|PATCH|DELETE /api/videos/[id]`, `POST /api/videos/[id]/interactions`, `PUT|DELETE /api/videos/[id]/interactions/[interactionId]`, `GET /api/interactions?type&q&videoId` (grouped by video). Ownership = query by `{ id, uploaderId }`, then `{ id, videoId }`; foreign/missing both give 404.
- Shared interaction rules (types, timestamp parse/format, `validateInteraction`) are in `lib/interactions/model.ts` and used by both server and editor form.
- Public viewing: `Video.shareId` (null = private, 16-char random token; clearing revokes). Owner toggles via `PUT|DELETE /api/videos/[id]/share` (`SharePanel` in the editor). `/watch/[shareId]` (outside `(app)`, no auth, noindex) renders `InteractivePlayer`; `lib/watch/service.ts` returns interactions WITHOUT `isCorrect`, and `POST /api/public/videos/[shareId]/interactions/[id]/answer` grades quizzes server-side (rate-limited in memory, same-origin checked). Only signed-in viewers can answer (anonymous get 401); one `InteractionResponse` per user+interaction, and answering again replaces it (latest wins). `Video.isListed` puts a shared video in the `/library` tab (author name shown). Owners see who answered what at `/responses` and `/responses/[videoId]` (+ CSV at `GET /api/videos/[id]/responses?format=csv`). Questions have `answerType` CHOICE (options) or TEXT (typed; TEXT quizzes use `Interaction.correctAnswer`, compared via `normalizeAnswer`). Auth pages honour a safe `?next=` (`lib/auth/redirect.ts`).
- Surveys/Quizzes pages are read-only views over `Interaction` (no template models); creating/editing happens in the video editor via `?new=SURVEY|QUIZ` / `?edit=<id>` deep links.

## Conventions
- Match existing style: web uses `@/` alias; mobile uses `@/` → `src/`; platform splits via `.web.tsx`.
- Shared logic/types used by both apps go in `packages/shared`.
- DB invariants enforced in Postgres (CHECKs, composite FKs).

## Open questions (fill in as decided; move answers to decisions.md)
- Test setup (vitest is installed in web, no tests yet).
- Deployment target.
