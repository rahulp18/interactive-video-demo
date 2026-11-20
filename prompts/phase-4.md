# Phase 4: Interactive player

## Where this fits

PARICHAY student demo (web only, student side), 7 phases:

1. Foundation (done)
2. Demo content and seed (done)
3. Student shell and login (done)
4. **Interactive player** ← this phase
5. Student pages
6. Parent preview
7. Polish and deploy

This is the heart of the demo: the child watches a story, it pauses, they answer, and at the end they get their rewards. Phase 5 builds the pages that lead here (Home, Journeys, module page). Phase 6 shows what these answers add up to.

## Goal

A **module player inside the student shell** with:

- every presentation style (moral choice, situational, emotion, predict, rating slider)
- no skipping of scored questions
- replay of the segment before a question
- progress saved after every answer, and resume where the child stopped
- a **module-complete rewards screen**

It records everything the scoring engine needs (FR-6.1), safely and idempotently. It never sends a score or weight to the browser.

**Stretch:** one branching consequence clip in one module (FR-5.8).

## Read first

- `CLAUDE.md`, `.claude/memory/architecture.md`, `.claude/memory/decisions.md`. Especially:
  - "Public viewing": how `/watch`, `checkPublicAnswer` and quiz grading work today; correctness never reaches the browser.
  - The 2026-11-10 entry: re-answering replaces the earlier answer.
  - The Phase 1, 2 and 3 entries:
    - a module counts only once `ModuleProgress.completedAt` is set
    - Phase 1 noted that `attemptCount` should increment on re-answer
    - demo videos are not UploadThing files
    - the Big Buck Bunny credit must be shown wherever demo videos play
- `apps/web/AGENTS.md` and the Next.js 16 docs before writing routes or pages.
- Code you will reuse or refactor:
  - `components/watch/InteractivePlayer.tsx`: pause-at-timestamp, the seek guard, the rAF trigger, fullscreen
  - `components/watch/InteractionOverlay.tsx`: modal, focus trap, bottom sheet on phones
  - `lib/watch/service.ts`: `PublicInteraction`, `checkPublicAnswer`, `getViewerAnsweredIds`
  - `lib/watch/client.ts`
  - `lib/api/route.ts` (`handle`)
  - `lib/auth/server.ts` (`requireStudent`)
  - `lib/scoring/service.ts` (`getChildView`) and the `ChildView` type in `lib/scoring/types.ts`
- Seed content in `apps/web/scripts/demo/content/`: modules, `presentationStyle`, the clip manifest, and `history.ts` (which module is in progress and which is unstarted).

## Context from the SRS and HLD

**Player requirements:**

- **FR-5.7:** playback pauses automatically at each interaction point. The child **cannot skip a scored interaction**, but **can replay the preceding segment**.
- **FR-5.8 (stretch):** a choice can lead to a different video segment showing its consequence, then return to the main story.
- **FR-5.9:** all text is narrated by audio. For the demo, a "read to me" button using the browser's speech synthesis is an acceptable stand-in.
- **FR-5.10:** resume from the last point.
- **FR-5.11:** progress is saved after every interaction, so a dropped connection loses nothing.
- **FR-5.12:** rewards after each module: stars, virtue badges, a growing virtue tree. **No leaderboards.**
- **FR-6.1:** per answer, record time taken, number of replays and attempt number.
- **FR-6.15:** the child sees no scores, no percentages, no "wrong" for virtue questions, and no weaknesses.

**The interaction styles (SRS §5.2) as they map to `presentationStyle`:**

| Style | What the child does |
|---|---|
| MORAL_CHOICE | picks what a character should do next (2–4 options) |
| SITUATIONAL | picks what *they* would do in a similar real-life situation |
| EMOTION | picks an emoji face for how a character or they feel |
| PREDICT | guesses the outcome before it is shown (may be a QUIZ) |
| RATING | agrees or disagrees on a 5-step slider |

**HLD answer flow (§5.2) and guardrails:**

- An answer is sent with an **idempotency key**, so retries on a bad network are safe.
- The server validates it against the published module, saves the answer and progress **in one transaction**, and replies fast (< 1 s) with what to play next.
- **No scoring on the client. No report generation inside the answer request.**

## Scope

### 1. Route and access

- **Player page:** `/student/modules/[moduleId]/play`. Phase 5 will add the module page at `/student/modules/[moduleId]` with a Play button; until then, link to the player directly for testing.
- **Guard:** `requireStudent`. The module must be `PUBLISHED` and **unlocked** for this student; otherwise show a friendly not-found or locked state.
- **Unlock rule.** Write it now as a pure, tested function (for example in `lib/learning/`), because the player has to enforce it and Phase 5 will display it:
  - Level 1 of a journey is always unlocked.
  - Level N is unlocked once every module in level N−1 of that journey is completed by this student.
  - A module that appears in several journeys is unlocked if it is unlocked in any of them.
- **Data sent to the browser:** video URL, title, duration, interactions with options, resume position, already-answered interaction ids, and the module's virtues by **name only**.
  - **Never** send `isCorrect`, weights or scores.
  - Reuse or extend the `PublicInteraction` shape, adding `presentationStyle`.

### 2. Server: student learning API

Put the logic in a service (for example `lib/learning/service.ts`) behind thin route handlers using `handle(..., { role: "STUDENT" })`. Every endpoint checks:

- the caller is a student
- the module is published and unlocked for them
- the interaction belongs to this module's video

**Save an answer:** for example `POST /api/student/modules/[moduleId]/answers`.

- **Input:** `{ interactionId, optionId | text, responseTimeMs, replayCount, positionSeconds, idempotencyKey }`.
- **Required questions cannot be skipped.** The server rejects a skip for `isSkippable: false`.
- **In one transaction:**
  - upsert the `InteractionResponse` (latest wins; `attemptCount` +1 on a real re-answer)
  - store `responseTimeMs` and `replayCount`
  - update `ModuleProgress` (create it with `startedAt` if missing; set `lastPositionSeconds`)

  Remember: inside `db.transaction` only `create` / `createAll` / `updateAll` / `deleteAll` work.
- **Idempotency:** a retry with the same key returns the same result and does **not** increment `attemptCount`. This probably needs a column, for example the response's last client request id. Add it in this phase's migration.
- **Reply:**
  - QUIZ (for example PREDICT): whether the guess matched, so the UI can say "Let's see what happens!" kindly.
  - SURVEY (all virtue questions): a neutral acknowledgement only. **No signal of how "good" the choice was.**
  - The next step: continue, or the branch segment (stretch).
- **Also fix the existing `/watch` answer path** so it records `attemptCount` the same way. Share one save function between both paths, and keep `/watch` working for teacher share links.

**Save progress:** for example `PUT /api/student/modules/[moduleId]/progress` with `{ positionSeconds }`.

- The client calls it throttled (about every 10 s while playing), on pause, and when leaving the page (`fetch` with `keepalive`).
- It never touches `completedAt`.

**Complete the module:** for example `POST /api/student/modules/[moduleId]/complete`.

- Accept only if every non-skippable interaction of the module is answered.
- Set `completedAt` **once**. Repeating the call is safe, and re-watching later doesn't move the date. Record this choice in decisions.md: re-answers on a re-watch update answers, but the completion date stays.
- **Reply with the rewards** by comparing `getChildView` before and after:
  - stars earned
  - newly earned badges
  - which virtues "grew" (names only, no numbers)
  - the module's follow-up activity
  - the next module: next in the journey if now unlocked, else back to the journey

  This is a read from the existing engine, not a stored report. It must stay fast.

### 3. Player UI (child-facing)

**Refactor, don't fork.** Pull the playback core (pause at timestamps, seek guard, rAF trigger, fullscreen) out of `InteractivePlayer` into a shared hook or component. Both the new student player and the existing `/watch` page use it, with different answer adapters. `/watch` behaviour stays the same.

**Controls:**

- big play/pause (48 px or more)
- fullscreen (the SRS asks for a full-screen mode)
- mute
- a progress bar showing question markers; the child can't seek past an unanswered required question (the existing guard)

**Resume:** start at `lastPositionSeconds`. If an unanswered required question sits before that point, start at that question instead. Questions already answered stay done.

**Question overlay:** one question at a time, little text, large tap targets. Build one component per style:

- **MORAL_CHOICE:** big option cards framed around the character ("What should Hare do?").
- **SITUATIONAL:** the same cards, framed around the child ("What would *you* do?"), with a distinct "you" visual cue.
- **EMOTION:** a grid of large emoji tiles, each with a one-word label.
- **PREDICT:** cards, then "Let's find out!" and continue. For a QUIZ, give gentle feedback ("Good guess!" / "Let's see!"). Never a red ✗.
- **RATING:** a 5-stop slider with face emojis and end labels.
  - It must be touched or moved before it can be submitted, so no answer happens by default.
  - Keyboard accessible (arrow keys, `role="slider"`, `aria-valuetext`).

**On every question:**

- **"Watch again"**: replays from the previous question's timestamp (or 0) up to this question, then shows the question again. It increments that question's `replayCount`.
- **"Read to me" 🔊**: reads the question and options aloud with `speechSynthesis`, preferring an `en-IN` voice. Hide the button if the browser doesn't support it.
- **`responseTimeMs`** = the time the question was visible, not counting replays.

**Saving:** the video continues only after the server confirms the save.

- On a network failure, keep the answer, retry with the **same** idempotency key and show a calm "Saving…" message.
- After a few failed tries, show a friendly retry button. Never silently drop an answer.

**Module complete screen:**

- stars appearing, newly earned badge(s)
- "Your Perseverance grew!" style lines (names only)
- "Try this at home": `followUpActivity`
- buttons for the next module and back to the journey
- respects `prefers-reduced-motion`

**Accessibility:** focus trap and return (as in the existing overlay), visible focus, AA contrast, works at 360 px wide, and every control is at least 48 px.

**Credit line:** show the clip attribution from the Phase 2 manifest near the video. Keep it small.

### 4. Stretch: one branch (FR-5.8)

Do this **only after everything above is done and tested.**

- **Data:** an option can name a consequence segment, for example nullable `branchStartSeconds` / `branchEndSeconds` on `InteractionOption`, with a CHECK that both or neither are set and that start < end. With the single placeholder clip, the segment is a span of the same video.
- **Behaviour:** after that option is saved, play the segment, then return to the main story just after the question.
- **Seed:** add one branching option to one module in the Phase 2 content. Keep `tests/demo-seed.test.ts` and the designed profile passing.

If you skip the stretch, say so in the summary. Don't leave half-built branch code behind.

### 5. Tests

- **Unlock rule:** level 1 open; level 2 locked until level 1 is complete; a module in two journeys.
- **Resume position:** normal case; an unanswered required question before the saved position.
- **Answer API:**
  - saves the response and progress together
  - a same-key retry doesn't increment `attemptCount`; a real re-answer does
  - a required question can't be skipped
  - an interaction from another module is rejected
  - locked or unpublished module → rejected
  - teacher → 403
  - **no response body ever contains `isCorrect`, a weight or a score** for SURVEY questions
- **Complete API:**
  - refused while a required question is unanswered
  - sets `completedAt` once and is safe to repeat
  - returns rewards with no numeric score fields
  - afterwards `getAssessment` counts the module
- **The `/watch` path** still works and now increments `attemptCount`.
- **Seed:** if the stretch is done, the profile test still passes.

## Out of scope

- The module page, Home, Journeys and My Virtue Tree (Phase 5)
- The Parent preview (Phase 6)
- Teacher editor support for styles or branches
- Drag-and-drop, mini-games and voice answers
- HLS / adaptive streaming, subtitles and Hindi
- Offline mode
- Async scoring workers

## Constraints

- Never reset or drop a database; migrate the **dev** database only.
- No scoring in the browser, and nothing derived from weights in any student-facing response.
- `/watch/[shareId]` and the teacher flows keep working.
- Run `pnpm --filter web demo:reset --yes` after manual testing, so the demo student is back to the designed state.

## Done when

- [ ] As Aarav (PIN login), open the **in-progress** module: it resumes at the saved point with the earlier answers kept, and finishing it shows the rewards screen.
- [ ] Open the **unstarted** module: every presentation style that module uses appears; "Watch again" and "Read to me" work; required questions can't be skipped.
- [ ] Stop the network (DevTools offline) mid-answer: the answer is kept and saved on reconnect, with no duplicate attempt.
- [ ] A locked module can't be opened by URL.
- [ ] `/watch/<shareId>` still works as before.
- [ ] `pnpm typecheck`, `pnpm --filter web lint` and `pnpm --filter web test` pass. `demo:reset` restores the designed profile.
- [ ] `.claude/memory/architecture.md` updated: player route, learning API and service, unlock rule, the shared playback core, idempotency. Drop the Phase 2 note that the answer endpoint leaves `attemptCount` at its default.
- [ ] `.claude/memory/decisions.md` has one entry covering:
  - continue only after the server confirms the save
  - SURVEY feedback is neutral
  - completion date is set once
  - how idempotency is stored
  - branch storage, if built
- [ ] A short summary for the user: the routes, what was refactored, whether the stretch branch was built (and in which module), and the exact click-path to show the player in the demo.
