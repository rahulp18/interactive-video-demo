# Phase 5: Student pages

## Where this fits

PARICHAY student demo (web only, student side), 7 phases:

1. Foundation (done)
2. Demo content and seed (done)
3. Student shell and login (done)
4. Interactive player (done; branching stretch skipped)
5. **Student pages** ← this phase
6. Parent preview
7. Polish and deploy

The player works, but students can only reach it by URL. This phase builds the four student destinations from the Phase 3 menu, plus the journey and module pages that lead into the player. Afterwards the whole child journey works by clicking: sign in → Home → Journey → Module → Play → rewards → Virtue Tree.

## Goal

Replace the `StudentPlaceholder` pages with the real thing:

- **Home**
- **Journeys**, plus a journey detail page
- **Module page**
- **My Virtue Tree**
- **Profile**, with an avatar the child picks

Everything a child sees must be encouraging only (FR-6.15). The demo student (Aarav) and the fresh student (Meera) must both look great.

`/student/parent` stays a placeholder (Phase 6).

## Read first

- `CLAUDE.md`, `.claude/memory/architecture.md` and `.claude/memory/decisions.md`. Especially:
  - the Phase 3 section: student routes, the menu, the scoped student theme, 48 px targets, the bottom tab bar
  - the Phase 4 section: player route, `lib/learning/`, unlock rule, rewards
  - the Phase 2 section: demo accounts, which module is in progress and which is unstarted, `demo:reset`
- `apps/web/AGENTS.md` and the Next.js 16 docs before writing pages. This app uses `cacheComponents`: read params in an inner async component under `<Suspense>`, and **never cache the user or child data**.
- Code to build on:
  - `lib/learning/rules.ts`: `unlockedModuleIds`, `isModuleUnlocked`, `nextModuleAfter`
  - `lib/learning/service.ts`, `lib/learning/types.ts`
  - `lib/scoring/service.ts`: `getChildView`, and `getAssessment` (only for `nextStepVirtueIds`; see below)
  - `lib/scoring/types.ts`: `ChildView`, `ChildBadge`, `ChildSuperpower`
  - how `buildChildView` in `lib/scoring/engine.ts` computes stars, badges and superpowers
  - `components/student/StudentPlaceholder.tsx`, `components/layout/*`, `components/videos/VideoThumb.tsx`
- The Phase 2 content in `scripts/demo/content/` (journeys, modules, virtues, clips).

## Context from the SRS

- **FR-4.7:** a student profile has a nickname shown in the app and an **avatar** (along with other fields this demo doesn't need).
- **FR-5.5:** modules are grouped into virtue journeys, with levels that unlock in sequence.
- **FR-5.12:** rewards are stars, virtue badges and a **growing "virtue tree"**. **No leaderboards and no comparing children.**
- **FR-5.15:** the system recommends modules based on weaker virtues.
- **FR-6.15:** the child sees an encouraging version only: badges, a growing virtue tree, "superpowers". **No weaknesses, no numeric scores.**
- **FR-5.4:** a module has a source story, virtues, a learning objective, discussion prompts (**for parents and teachers**, not the child) and a follow-up activity.
- **§3:** big touch targets (48 px or more), minimal text, no external links, usable at 360 px.
- **NFR-9.15:** pages load in under 3 s.
- **NFR-9.20:** colour-blind-safe.

## Rules that apply to every page in this phase

1. **No scores anywhere a child can see**: no score, percentage, confidence, trend, rank or "weak" wording.
   - Stars, badges, and counts of stories finished are fine.
   - Watch progress ("half-way through") is fine; it's about the video, not the child.
2. **Never sort or compare virtues by how well the child does.** Virtues always appear in their fixed order (1–10).
   - Stars per virtue come from positive answers, so a "fewest stars" view would reveal a weakness. Don't build one.
   - Every virtue always shows something growing: at least a bud, with growth wording ("Ready to grow!").
3. **Recommendations may use the engine but never explain themselves.** "Try this next" may be chosen using `nextStepVirtueIds` from `getAssessment` (FR-5.15). The page must not say why. Keep that call on the server; send the browser only the chosen module.
4. **Child-facing loaders return child-safe types only.** Define the page data types in `lib/learning/types.ts` (or next to them) with no score fields, the same way `ChildView` does. No discussion prompts on child pages.
5. **One visual identity per virtue** (icon + colour + short child-friendly line), defined in **one** module, for example `lib/virtues/display.ts`. Phase 6 reuses it.
   - Colours must be colour-blind-safe.
   - **Colour is never the only signal**: always show the icon and the name too.
6. **Performance:** one server loader per page (no N+1 queries), skeletons under `<Suspense>`, and under 3 s against the dev Neon database.

## Scope

### 1. Overview loader (server, `lib/learning/`)

Write one function, for example `getStudentOverview(userId)`, that the pages share. It returns child-safe data:

- **Journeys:** each with its focus virtue, levels, and modules in order. Each module has a status: `completed` / `in-progress` (with watch progress) / `ready` / `locked`. Use the existing unlock rule.
- **Continue:** the most recently active in-progress module, if any.
- **Up next:** if nothing is in progress, the best unlocked, unstarted module. Prefer modules whose primary virtue is in `nextStepVirtueIds`, then journey order. A fresh student gets the first level-1 module.
- **Child view:** stars, badges, superpowers (`getChildView`) and the number of stories finished.

### 2. Home (`/student`)

- **Greeting:** "Hi Aarav! 👋" with the child's avatar.
- **A big "Continue your story" card**, which resumes in the player. Otherwise an "Up next" card.
- **A small tree preview** with total stars, linking to My Virtue Tree. Show the newest badge if there is one.
- **Journeys strip:** cards with how many stories are done in each.
- **Fresh student (Meera):** a warm first-time state with one big "Start your first story" button.

### 3. Journeys (`/student/journeys` and `/student/journeys/[journeyId]`)

**List:** one card per journey, showing:

- focus virtue icon and colour
- title and a one-line description
- how many stories are done, for example "3 of 4 stories"

**Detail:** levels drawn as a path.

- A locked level shows a lock and "Finish Level 1 to unlock".
- Module tiles show their status. A tile opens the module page; a locked tile only explains that it's locked.
- An unknown journey shows a friendly not-found.

### 4. Module page (`/student/modules/[moduleId]`)

- **Story cover and title.** All demo modules share one placeholder clip, so a video frame would look the same on every card. Build covers from the module's virtue identity (colour, icon, title). Optionally add a frame taken at a different time per module.
- **Where the story comes from**, for example "A story from the Panchatantra".
- **Virtue chips** (names and icons).
- **"In this story you'll learn…"**, from `learningObjective`. Rephrase only if the seed text reads as adult-facing.
- **Main button:** **Play**, **Continue** (with watch progress) or **Watch again**, leading to the Phase 4 player.
- **Once completed**, also show "Try this at home" with `followUpActivity`.
- **Locked:** a friendly lock and how to unlock it. Unlocking is still enforced on the server by the Phase 4 guard.
- **Unknown or unpublished:** friendly not-found.
- **No discussion prompts on this page.**
- Point the player's rewards screen "next" and "back" links at these new pages where that makes sense.

### 5. My Virtue Tree (`/student/virtues`)

- **The tree:** an SVG drawn in code, with a trunk and 10 branches in fixed virtue order.
  - The **whole tree grows with total stars** (sapling → young tree → full tree, in a few stages).
  - Each branch shows leaves or blossoms for that virtue's stars. **Every branch shows at least a bud.**
  - No numbers on branches, and no labels like "lowest".
  - Animate gently and respect `prefers-reduced-motion`.
- **"Your superpowers"**: from `ChildView.superpowers`, each with its icon and a celebratory line.
- **Badge shelf:** earned badges, with titles reworded for children where the engine's title is technical (for example "Story finished"). Optionally show a few next badges as silhouettes with "Keep going!" wording.
- **The 10 virtues explained** in child language: icon + name + one line. Use the seed's `essence` as a starting point and simplify it. No scores.

### 6. Profile (`/student/profile`)

- **Avatar picker:** about 8–12 preset friendly avatars (animals, emoji or simple SVG; no uploads, no external images).
  - Needs a small migration: for example `User.avatar` as a text key, with a DB CHECK against the preset list or a format CHECK.
  - Saved through a student-only endpoint or server action, with a same-origin check.
  - Show the avatar in the shell header and on Home.
  - Seed: give Aarav an avatar in `seed:demo`. `demo:reset` should leave it alone.
- **Shown:** name, username, stories finished, total stars, badge count.
- **"For grown-ups"** link (already in the shell) and **Sign out**.
- **Not included:** changing the PIN (set server-side only), editing the name, nickname, date of birth, grade and language.

### 7. Tests

- **Overview loader for the demo student after `demo:reset`:**
  - module statuses match the seeded history
  - the in-progress module is "Continue"
  - level-2 locking matches the unlock rule
- **Overview loader for a fresh student:** level-1 modules are ready, everything else is locked, and "Up next" is the first module.
- **"Up next" prefers a module whose primary virtue is in `nextStepVirtueIds`,** and the loader's result doesn't contain those ids or any reason.
- **A child-safety check over every child-facing loader's JSON:** no keys like `score`, `composite`, `confidence`, `trend`, `swot`, `weak*` or `threat*`, and no `discussionPrompts`.
- **Virtue order is fixed** regardless of stars.
- **Avatar:**
  - a valid key is saved
  - an invalid key is rejected (API and DB CHECK)
  - a teacher can't call the endpoint
- **Access:** teachers are redirected from all student pages; an unknown journey or module is a not-found, not a crash.

## Out of scope

- The Parent preview: radar, SWOT, trends, discussion prompts (Phase 6)
- Player changes beyond updating its next/back links
- Teacher pages
- Assignments
- The baseline game (FR-4.16)
- The full profile (date of birth, grade, language, parent fields)
- Hindi, audio narration of whole pages, mobile app

## Constraints

- Never reset or drop a database; migrate the **dev** database only.
- No caching of child data. No scores reach the browser.
- Keep the Phase 3 shell rules: student theme tokens only, 48 px targets, works at 360 px, light and dark mode.
- After manual testing, run `pnpm --filter web demo:reset --yes`.

## Done when

- [ ] **As Aarav (PIN login):** Home shows "Continue your story" → module page → player resumes → rewards → back to the journey, with the next level unlocked if it now should be. My Virtue Tree shows the grown tree, superpowers and badges, with no numbers.
- [ ] **As Meera:** Home shows the first-time state. Only level-1 stories are open, and finishing one updates Home and the tree.
- [ ] The avatar picked on Profile appears in the header and on Home.
- [ ] Every student page works at 360 px wide and in dark mode, and loads in under 3 s on the dev database.
- [ ] `pnpm typecheck`, `pnpm --filter web lint` and `pnpm --filter web test` pass. `demo:reset` restores the designed state.
- [ ] `.claude/memory/architecture.md` updated: the student pages and routes, the overview loader, the virtue display module, the avatar. Remove "Home/Journeys/Virtue Tree pages are still placeholders".
- [ ] `.claude/memory/decisions.md` has an entry covering:
  - virtues are never ranked or sorted by performance; every branch shows growth
  - recommendations use `nextStepVirtueIds` but never explain why to the child
  - why covers are built from virtue identity instead of video frames
  - the avatar storage format
- [ ] A short summary for the user, including the exact click-path for the demo through these pages.
