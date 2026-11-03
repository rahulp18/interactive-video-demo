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

## 2026-11-03 � Video upload via UploadThing, persisted in `onUploadComplete`
Decision: single `videoUploader` file route (`app/api/uploadthing/core.ts`): auth in `middleware` via the existing `requireUser`/`assertSameOrigin` (cookie or bearer), video-only, 512MB, 1 file, mp4/webm/mov. The Video row is created only in `onUploadComplete`, idempotent on unique `Video.fileKey`; uploader id comes from middleware metadata. If the DB write fails the UploadThing file is deleted (UTApi). Stored URL is `file.ufsUrl` (`url`/`appUrl` are deprecated).
Why: UploadThing calls `onUploadComplete` via a signed callback, possibly more than once; the unique key makes retries safe and no row exists for failed uploads. Added `Video.uploaderId/fileKey/originalName/sizeBytes` (migration `add_video_upload_fields`).
Consequences: `Video.duration` is browser-reported (UploadThing doesn't probe media) � treat as a hint; no server-side ffprobe yet. Files are public-read URLs. When planning migrations the `db` ref was stale (pointed at init) so `migration plan` needed `--from <head hash>`.

## 2026-11-03 - Interaction updates preserve option rows; timestamps validated against Video.duration
Decision: `PUT .../interactions/[id]` matches options by `id` (update in place), creates new ones and deletes omitted ones in one transaction; kept options are first parked at `position + 1_000_000` because `(interactionId, position)` is unique and not deferrable. Timestamps are rounded to 0.1s and must be within `0..Video.duration`.
Why: `InteractionResponse` has a composite FK to options with NoAction, so delete-and-recreate would break (or destroy) existing responses; removing an option that already has responses returns 409 instead of partially applying.
Consequences: Duration is the browser-reported hint (see upload decision), so a wrong duration also constrains where interactions can be placed. Inside `db.transaction` only `create`/`createAll`/`updateAll`/`deleteAll` are used (single-row `update`/`delete` and nested creates hang inside a tx).

## 2026-11-03 - `getCurrentUser` calls `connection()`
Decision: `lib/auth/server.ts` awaits `connection()` before reading the cookie.
Why: `validateSession` compares against `new Date()`, which Next 16 reports as an error during the runtime prerender used by partial prefetching (it was logged for /dashboard and would be for every protected page).
Consequences: the user/session is never part of a prerendered or prefetched shell, matching the earlier "do not cache the user" rule.

## 2026-11-03 - Upload takes an optional title
Decision: `videoUploadInput` accepts `{ duration, title? }`; `saveUploadedVideo(userId, duration, file, title?)` falls back to the filename. The /upload page requires a title before the file picker is enabled.
Why: users name the video up front; no second upload mechanism or rename-after-upload step needed.

## 2026-11-03 - Public watch links are unlisted tokens; anonymous answers are not persisted
Decision: sharing = nullable unique `Video.shareId` (migration `add_video_share_id`). Correctness is never sent to the browser; quizzes are graded by a public endpoint after the viewer answers. No response rows are written for anonymous viewers.
Why: `InteractionResponse` is keyed by (userId, interactionId) with a CHECK/composite FK, so anonymous storage would need a schema redesign (anonymous viewer identity) - deferred until analytics is in scope.
Consequences: revoking sets shareId to null (old links die at once; re-enabling issues a new token). The in-memory rate limiter is per instance; put a shared limiter in front for multi-instance deployments.

## 2026-11-03 - Identified responses, Library, and text answers
Decision: (1) viewers answer as signed-in users so owners can see who responded (`InteractionResponse` stores the first answer per user+interaction); anonymous link visitors can answer but nothing is stored, and the watch page says so. (2) `Video.isListed` adds a platform Library alongside the secret link; listing requires a link and unsharing clears it. (3) `Interaction.answerType` CHOICE|TEXT; typed answers go in `InteractionResponse.textAnswer`, with CHECKs `isSkipped = (no option and no text)` and "never both". (4) Login/register honour `?next=` only for same-site absolute paths.
Why: the owner needs per-person results; the existing table already modelled one response per user; typed answers avoid forcing everything into options.
Consequences: owners can see viewers' names and emails (the watch page discloses this). `?next=` is read via `useSyncExternalStore`, not `useSearchParams()`, because the auth forms sit in a prerendered shell with no Suspense boundary. Changing a question from CHOICE to TEXT deletes its options and fails with 409 if any option already has responses.
