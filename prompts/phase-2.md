# Phase 2: Demo content and seed

## Where this fits

PARICHAY student demo (web only, student side), 7 phases:

1. Foundation (done)
2. **Demo content and seed** ← this phase
3. Student shell and login
4. Interactive player
5. Student pages
6. Parent preview
7. Polish and deploy

Phase 1 built the tables and the scoring/SWOT engine. This phase fills them with believable demo content and a demo student whose history produces a **specific, designed profile**, so every later screen has something real to show.

## Goal

Two things:

- A **repeatable seed** that creates the PARICHAY demo content: 10 story modules in 3 journeys, with virtue-weighted questions, demo accounts, and a demo student with about 4 months of history plus parent and teacher ratings.
- A **reset** that puts the demo student back to that exact state after a rehearsal.

The demo student's assessment must land on a target profile, checked automatically.

This phase adds **no UI**.

## Read first

- `CLAUDE.md`, `.claude/memory/architecture.md` (the "PARICHAY data model and scoring engine" section) and `.claude/memory/decisions.md`. The 2026-11-20 Phase 1 entry defines how scores, confidence, trend and SWOT are computed; this seed has to produce data that works with those exact rules.
- `apps/web/prisma/contract.prisma`: `Video`, `Interaction`, `InteractionOption`, `InteractionResponse`, `Virtue`, `Module`, `ModuleSecondaryVirtue`, `Journey`, `JourneyModule`, `OptionVirtueWeight`, `ModuleProgress`, `VirtueRating`.
- `apps/web/lib/scoring/` (`rules.ts`, `engine.ts`, `service.ts`). You'll use `getAssessment` / `getChildView` to verify the result and `validateParentMarks` for the ratings.
- The `prisma-8` skill's `queries.md` before writing inserts. Known gotcha: inside `db.transaction` only `create` / `createAll` / `updateAll` / `deleteAll` work.
- `apps/web/migrations/app/*/migration.ts`: they run as TypeScript directly under `node`. Use the same approach for the seed script, or add a runner as a dev dependency with pnpm.

## Decisions already made (don't revisit)

- **Videos: placeholder clips, original scripts.** Real story videos don't exist yet. Use freely licensed, child-appropriate clips (for example the Blender open movies such as *Big Buck Bunny*) from stable HTTPS URLs. Several modules can reuse the same clip.
  - The **story scripts, questions and weights are original and are the real deliverable**. The clip is a stand-in.
  - Keep each clip's URL, duration and licence/attribution in one manifest, so swapping in a real video later means changing one entry.
  - No violence or scary scenes; the audience is 8–12.
- **Hosting:** Vercel + Neon. This phase runs **only against the dev database** from `apps/web/.env`. Phase 7 runs it on production.
- **Logins:** email + password for now. Phase 3 adds a username + PIN login for students and will extend this seed. Design the account section so that's easy.

## Scope

### 1. Content (typed data files, separate from the seed logic)

Put the content in plain typed data under, for example, `apps/web/scripts/demo/content/`. A content reviewer (in real life, the child psychologist) should be able to read it without reading code.

- **10 modules, one per virtue as primary.** Each module has 1–2 secondary virtues. Stories are adapted from the SRS sources: Panchatantra, Hitopadesha, Jataka tales, Aesop's Fables, Akbar–Birbal, Tenali Raman, Indian folk tales.
  - Use the SRS's own examples where they fit: *The Tortoise and the Hare* (Perseverance), *The Honest Woodcutter* (Honesty), *The Boy Who Cried Wolf* (Responsibility), *The Dove and the Ant* (Friendship), *The Ant and the Grasshopper* (Work).
  - **Faith** must be pluralistic: hope, gratitude, reverence for life. Not tied to one religion.
- **Each module** fills every `Module` field:
  - source story
  - age band
  - a one-sentence learning objective
  - 2–3 discussion prompts for parents/teachers
  - one small real-world follow-up activity
  - status `PUBLISHED`
- **4 interaction points per module** (the SRS allows 3–6), spread across the clip's real duration.
  - Mix the `presentationStyle` values (MORAL_CHOICE, SITUATIONAL, EMOTION, PREDICT, RATING). Every module has at least one SITUATIONAL question ("what would *you* do?").
  - EMOTION questions use an emoji plus a short word per option.
  - RATING questions have exactly 5 ordered options, from "Not at all like me" to "Very much like me".
  - Scored questions are `isSkippable: false`.
  - Use type `SURVEY` for virtue questions (no right answer). A PREDICT question may be a `QUIZ` with a correct option if it measures understanding of the story.
- **Weights:**
  - Each option weighs 1–2 virtues, drawn from the module's primary and secondary virtues.
  - Every scored question has a spread of weights (a clearly good option, a neutral option with no weight row, a poor option with −1/−2). Otherwise the min–max score has nothing to measure.
  - The wrong-but-understandable answer should not be cruel; these are 8–12-year-olds.
- **Language:** short sentences at the child's grade level. Questions talk to the child ("What should Hare do now?"). Avoid shame words like "bad" or "selfish" in options; describe the action instead.
- **3 journeys** with a focus virtue and 2 levels each. Together they contain all 10 modules. For example:
  - *Perseverance Path*
  - *Honesty Trail*
  - *Kindness & Friends*

  Assign the remaining modules where they fit thematically.

### 2. Accounts

- **A content owner** (role TEACHER) who uploads the demo videos (`Video.uploaderId`), for example "PARICHAY Content Team".
- **The demo student**, for example "Aarav", age 10, role STUDENT.
- **A fresh student** with no history, for showing the first-time experience and empty states.
- Passwords come from an environment variable (for example `DEMO_PASSWORD`, documented in `.env.example`). Never hard-code or print them. The deploy is public.

### 3. The demo student's history: a designed profile

Seed backdated `ModuleProgress.completedAt` values over about 4 months, with responses to the completed modules' questions. Use realistic `responseTimeMs` and the occasional `replayCount`.

Also seed:

- **Parent ratings**: one rater, for example "Priya (mother)", rating all 10 virtues, with at most 3 STRENGTH and at most 3 IMPROVE marks. Check them with `validateParentMarks`. Add one older set from about 3 months earlier as well, to show that past versions are kept.
- **Teacher ratings** for some virtues, so the 3-way comparison has data.

**Leave these open for the live demo:**

- at least **one module not started**, in a level that is already unlocked
- **one module in progress**: started, with `lastPositionSeconds` part-way through, not completed, and its first 1–2 answers saved

**The target profile.** Under `SCORING_RULES_V1`, `getAssessment` for the demo student must show every SWOT quadrant and every confidence state:

| Must show | Example virtue | How to get there |
|---|---|---|
| Strength | Compassion, Friendship | composite ≥ 70, trend not falling |
| Weakness by score | Self-Discipline | composite < 45 |
| Weakness by parent mark | Honesty | parent IMPROVE + child < 60 |
| Opportunity | Perseverance | 45–70 and rising (early modules low, recent high) |
| Threat: decline | Responsibility | fell ≥ 15 within 90 days |
| Threat: gap | Work | \|parent − child\| ≥ 30 |
| Not enough data | Faith | < 8 scored interactions |
| high / medium / low confidence | spread across the rest | vary how many weighted questions each virtue gets |

The virtue choices are suggestions; swap them if the content fits better another way. What's fixed is that **every** row is covered.

Plan backwards from the rules. A virtue needs ≥ 8 scored interactions across its modules to leave "insufficient", and a trend needs module completions on both sides of the 90-day window. If the content can't produce the profile, adjust the content: add weights on secondary virtues, or a 5th question. **Never change the scoring rules.**

`getChildView` for the demo student must also return superpowers and several badges, so Phase 5 has something to show.

### 4. Scripts

Add to `apps/web/package.json`:

- **`seed:demo`**: creates or updates the content, accounts and history.
  - **Idempotent**: running it twice changes nothing.
  - Identify demo rows by a natural key: `Video.fileKey` = `demo:<module-slug>`, demo account emails on a reserved domain, journey titles.
- **`demo:reset`**: deletes the demo student's progress, responses and ratings, and re-creates the designed history. It leaves content and other users alone. This is what the presenter runs before each demo.

Both scripts must:

- print the target database **host only**, never the URL or credentials
- refuse to run unless the database is clearly the intended one (for example a `--yes` flag, or an env var that has to match the host)
- touch only demo-owned rows. Never delete by anything broader than the demo natural keys.

Seeded demo videos should get a `shareId`, so they can be played through the existing `/watch/[shareId]` before Phase 4 exists. Keep `isListed` false.

Watch out: deleting a demo video may trigger the UploadThing file deletion in existing code paths. Demo videos aren't UploadThing files, so make sure nothing tries to delete `demo:` keys remotely.

### 5. Tests

`apps/web/tests/demo-seed.test.ts`:

- Seeding content twice gives the same row counts (idempotent).
- The content is valid:
  - every module has 3–6 questions
  - every scored question has a spread of weights
  - RATING questions have 5 options
  - every interaction timestamp is within the clip's manifest duration
  - every virtue is primary in exactly one module
- Seeding the designed history for a **throwaway student** (not the real demo account) produces the target profile above. Assert each quadrant, the insufficient virtue and the confidence spread through `getAssessment`, and that `getChildView` returns superpowers and badges.
- `demo:reset` brings a modified demo student back to the same assessment.

## Out of scope

- Any UI, including a teacher UI for editing weights or module metadata
- Username + PIN login (Phase 3)
- Player changes (Phase 4)
- Real video production or hosting videos on UploadThing
- Hindi content
- Running against production (Phase 7)

## Constraints

- Never reset or drop a database. No schema change is expected in this phase. If you find one is truly needed, stop and explain why before making it.
- Don't change `SCORING_RULES_V1` or the engine to make the profile fit. Fit the data to the rules.
- Never print or commit `.env` or the demo password.
- Existing tests still pass, and the teacher flows still work for non-demo videos.

## Done when

- [ ] `pnpm --filter web seed:demo --yes` against the dev DB creates everything, and a second run changes nothing.
- [ ] Signed in as the demo student, a seeded module plays at `/watch/<shareId>` and its questions appear at the right times.
- [ ] `getAssessment` for the demo student shows all target quadrants and confidence states. `getChildView` shows superpowers and badges.
- [ ] `pnpm --filter web demo:reset --yes` restores that state after answering a few questions by hand.
- [ ] `pnpm typecheck`, `pnpm --filter web lint` and `pnpm --filter web test` pass.
- [ ] `.claude/memory/architecture.md` says where the demo content and scripts live, the natural keys, and that `demo:reset` runs before each demo.
- [ ] `.claude/memory/decisions.md` has an entry recording placeholder clips with the manifest-swap approach, the designed-profile approach, and why the demo uses reset rather than a fresh seed.
- [ ] A short summary for the user that includes:
  - the module/journey list (story → virtues)
  - the demo accounts (no passwords)
  - the profile the demo student shows, per virtue
  - which module is left open and which is in progress, for the live demo
  - clip attributions that must be shown or credited
