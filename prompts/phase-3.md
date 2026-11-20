# Phase 3: Student shell and login

## Where this fits

PARICHAY student demo (web only, student side), 7 phases:

1. Foundation (done)
2. Demo content and seed (done)
3. **Student shell and login** ← this phase
4. Interactive player
5. Student pages
6. Parent preview
7. Polish and deploy

Phases 1–2 built the data, the scoring engine and the demo content. This phase gives the child a shell that looks and feels like a kids' learning app, and the SRS student login (username + 4-digit PIN). Phases 4–6 fill the pages inside this shell.

## Goal

1. **Cut the student app down to 4 destinations**, give it a kid-friendly look, and make students land on `/student`.
2. **Add username + PIN sign-in for students (FR-4.4)**, safe against PIN guessing.
3. **Remove the old student pages** the demo no longer uses.

The teacher experience must not change.

## Read first

- `CLAUDE.md`, `.claude/memory/architecture.md`, `.claude/memory/decisions.md`. Several sections apply:
  - "Roles": all rules live in `lib/auth/roles.ts`; every page guards itself.
  - "Sign-in / sign-up UI": `AuthCard`, `useAuthForm`, and **no demo-login, remember-me or forgot-password UI**.
  - The session design: one `Session` table, cookie for web, bearer for mobile.
  - The Phase 2 demo entries.
- `apps/web/AGENTS.md`, and the Next.js 16 docs it points to, before writing pages or route handlers.
- Code you will change:
  - `lib/auth/roles.ts`
  - `components/layout/nav-items.ts`, `AppFrame.tsx`, `AppShell.tsx`
  - `components/student/StudentPlaceholder.tsx`
  - `app/(app)/student/*`, `app/(app)/home`, `app/(app)/results`
  - `app/page.tsx` (the landing page's Student button)
  - `lib/auth/{service,validation,password,session,http,forms,client}.ts`
  - `app/api/auth/login/route.ts`
  - `components/auth/*`
  - `app/globals.css`
- `scripts/demo/`: the Phase 2 seed, which you'll extend with student usernames and PINs.
- Tests to update: `tests/roles.test.ts`, `tests/student-nav.test.ts`, `tests/auth.test.ts`.

## Context from the SRS

- **FR-4.4:** students log in **without email**, using a username plus a 4-digit PIN. A picture password and class login codes on school devices are also mentioned; those are out of scope here.
- **§3:** child-facing screens use large touch targets (**at least 48 × 48 px**), minimal text, and no external links. Pages must be usable down to **360 px** wide.
- **NFR-9.19 / 9.20:** bright and simple; WCAG 2.1 AA contrast; colour-blind-safe.
- **FR-6.15:** the child never sees weaknesses or scores. That matters for Phase 5, but don't put anything in the shell that hints at them.
- A real child account is created by a parent (FR-4.1–4.3). There are no parent accounts in this demo, so usernames and PINs are set by the seed or by a server function, not by the child.

## Scope

### 1. Navigation and routing

**Student menu:** exactly 4 destinations, in this order.

| Label | Route | Status after this phase |
|---|---|---|
| Home | `/student` | placeholder until Phase 5 |
| Journeys | `/student/journeys` | placeholder until Phase 5 |
| My Virtue Tree | `/student/virtues` | placeholder until Phase 5 |
| Profile | `/student/profile` | placeholder until Phase 5 |

**A "For grown-ups" link to `/student/parent`.**

- Visually separate from the child's menu, and low-key: for example at the bottom of the sidebar or inside Profile.
- Create the route as a placeholder now. Phase 6 builds it and decides whether it needs a parental gate.
- It needs the same student guard as every other student page.

**Remove** `/student/learning`, `/student/assignments`, `/student/progress`, `/student/reports`, `/home` and `/results`.

- Delete their pages and their entries in `nav-items.ts`, and update `STUDENT_ONLY` in `roles.ts`.
- Old URLs may simply 404. Redirects aren't needed for a demo.

**Students start at `/student`:**

- `homePathFor("STUDENT")` returns `/student`.
- The landing page's Student button sends `next=/student`.
- `intendedRoleFor` no longer relies on `/library` being the student signal. Re-check `postAuthPath` and `welcomePathFor` behaviour in tests.

**`/library`** stays a shared route and stays in the teacher menu. It leaves the student menu, so drop `alsoActive: ["/library"]`.

**Keep** the existing `/watch/[shareId]` and `/welcome` working. Phase 4 replaces watching inside the shell.

### 2. Kid-friendly student shell

- **Scope the style to students only.** For example, `AppFrame` sets a `data-audience="student"` attribute and the student tokens are defined under it in `globals.css`. Teacher pages must render exactly as before.
- **Look:**
  - a warm, bright primary colour and friendly accents
  - rounder corners
  - a slightly larger base font
  - optionally a rounded, friendly font loaded with `next/font`, for students only

  Keep everything token-based, with light and dark mode both working, and WCAG AA contrast for text.
- **Layout:**

  | Width | Navigation |
  |---|---|
  | phones (`< md`) | a **bottom tab bar** with the 4 destinations: icon plus short label, 48 px or more, safe-area padding |
  | `md`–`lg` | the existing icon rail |
  | `lg+` | the existing full sidebar |

  The "For grown-ups" link is not a tab.
- **Every interactive element in the student shell is at least 48 × 48 px.** Header items, the logout control and the nav all count.
- **Restyle `StudentPlaceholder`** to match, with friendly "coming soon" copy. It is never shown in the final demo, but it shouldn't look broken in between.

### 3. Username + PIN sign-in

**Data (one migration, following the Prisma 8 workflow in `.claude/rules/database.md`):**

- `User.username`
  - unique and nullable
  - stored lowercase; 3–20 characters from `[a-z0-9_]`
  - enforced with a DB CHECK
- `User.pinHash`
  - nullable
  - only students may have one (a CHECK like `"pinHash" IS NULL OR "role" = 'STUDENT'`)
  - a student with a PIN must have a username
- **Lockout state:** for example a failed-attempt counter and a locked-until timestamp.

**Security.** A 4-digit PIN has only 10,000 combinations, so this matters:

- **Lock out in the database, per account**, for example 5 wrong PINs → locked for 15 minutes. The existing in-memory `rateLimit` is per instance, and on Vercel every request may hit a different instance, so on its own it is not protection. Also apply `rateLimit` to the new endpoint.
- **Hash the PIN** with the same hasher as passwords (`lib/auth/password.ts`). Never store or log it in plain text.
- **Give the same generic error** for an unknown username, a wrong PIN and a user with no PIN, with similar timing (reuse the `verifyAgainstDummy` approach). A locked account gets a distinct, child-friendly message ("Too many tries. Ask a grown-up, or try again in a little while"). The message must not reveal whether a username exists.
- **Reset the counter** on a successful login.
- Teachers can never sign in with a PIN.

**API:**

- A separate route, for example `POST /api/auth/pin-login`.
- It behaves like the existing login: same-origin check, revoke any previous token, a cookie for web, and a token in the body for mobile.
- Input parsing goes in `lib/auth/validation.ts`, copying out only the named fields.

**Setting a PIN.** Add a server-side function (not a page) such as `setStudentCredentials(userId, username, pin)`, used by the seed and the tests. Nobody can set a PIN through the UI in this demo.

**Sign-in UI on `/login`:**

- **Two clear choices:** "I'm a student" (username + PIN) and "Grown-up / Teacher" (email + password, unchanged).
- **Default to the student option** when `?next=` points at a student route, or when there's no `next`.
- **The student option:**
  - a username field
  - a **PIN pad**: 4 dots plus big 0–9 buttons and a delete button, each at least 48 px; keyboard digits work too
  - submits automatically on the 4th digit
- Reuse `AuthCard` / `useAuthForm`.
- **No demo-login button and no pre-filled credentials** (see memory).

**Registration (`/register`):** leave it unchanged.

### 4. Seed

Extend the Phase 2 seed so both demo students get a username (for example `aarav` and the fresh student's) and a PIN from a new env var, for example `DEMO_STUDENT_PIN`. Document it in `.env.example`; never print it.

- `seed:demo` stays idempotent.
- `demo:reset` must **not** reset credentials, but **must** clear the lockout state, so a rehearsal mistake can't lock the presenter out.

### 5. Tests

- **Roles:**
  - the student home is `/student`
  - removed prefixes are gone
  - `postAuthPath`, `intendedRoleFor` and `welcomePathFor` behave correctly for the new routes
  - teachers are still blocked from `/student/*`, including `/student/parent`
- **Nav:** the student menu is exactly the 4 items in order, the grown-ups link points at `/student/parent`, and the teacher menu is unchanged.
- **PIN login:**
  - success (cookie for web, token for mobile)
  - the same error for unknown user, wrong PIN and teacher account
  - lockout after N failures, including while the correct PIN is used
  - unlock after the window
  - counter reset on success
  - `pinHash` never appears in any response
  - DB CHECKs reject: a teacher with a PIN, a bad username format, a duplicate username
- **Seed:** `demo:reset` clears the lockout.
- Existing auth tests still pass.

## Out of scope

- The real content of Home, Journeys, My Virtue Tree and Profile (Phase 5)
- The player (Phase 4)
- The Parent preview content and any parental gate (Phase 6)
- Picture passwords and class login codes
- A UI for parents or teachers to set PINs
- Changing public registration
- Mobile app
- Hindi

## Constraints

- Never reset or drop a database; migrate the **dev** database only.
- Never print or commit `.env`, `DEMO_PASSWORD` or `DEMO_STUDENT_PIN`.
- Authorization stays server-side and centralized in `roles.ts`. Hiding a link is not access control.
- The teacher UI looks and behaves exactly as before. Check `/dashboard`, `/videos/[id]` and `/library` as a teacher.

## Done when

- [ ] Signed in as the demo student with username + PIN, you land on `/student`. You see the 4-item menu (a bottom tab bar on a phone-width window, the sidebar on desktop) and the "For grown-ups" link.
- [ ] Removed routes are gone. A teacher opening `/student/parent` is redirected.
- [ ] 5 wrong PINs lock the account. `pnpm --filter web demo:reset --yes` unlocks it.
- [ ] The student shell is usable at 360 px wide, every control is at least 48 px, and light and dark mode both look right. Teacher pages are unchanged.
- [ ] `pnpm typecheck`, `pnpm --filter web lint` and `pnpm --filter web test` pass.
- [ ] `.claude/memory/architecture.md` is updated: student routes and menu, student home, the PIN login and its lockout, the student theme scoping. Remove the now-stale lines about `/home`, `/results`, `/library` as the student home, and the 8 placeholders.
- [ ] `.claude/memory/decisions.md` has an entry covering why the lockout lives in the DB (serverless instances), why usernames and PINs are set server-side only, and why the student theme is scoped by attribute.
- [ ] A short summary for the user: the new login flow, the demo student usernames (no PINs), the env vars added, and anything left for Phase 5/6.
