# Phase 1 — Foundation: virtue data model + scoring & SWOT engine

## Where this fits

PARICHAY student demo (web only, student side), built in 7 phases:

1. **Foundation** ← this phase
2. Demo content & seed
3. Student shell & login
4. Interactive player
5. Student pages
6. Parent preview
7. Polish & deploy

Every later phase depends on this one. Phase 2 seeds content into the tables you create. Phases 5–6 render what your engine returns.

## Goal

Add the data model PARICHAY needs on top of the existing interactive-video app. Then build the **rule-based virtue scoring and SWOT engine** as pure, tested TypeScript.

This phase adds **no UI** and **no demo content**. The only data it inserts is the 10 virtue reference rows.

## Read first

- `CLAUDE.md`, `.claude/memory/architecture.md`, `.claude/memory/decisions.md`. Several decisions there constrain this work, for example:
  - re-answering replaces the earlier answer (latest wins)
  - inside `db.transaction` only `create` / `createAll` / `updateAll` / `deleteAll` work
  - `migration plan` may need `--from <head hash>`
- `.claude/rules/database.md`, `apps/web/prisma-8.md`, and the `prisma-8` skill in `apps/web/.claude/skills/`. Open its `contract.md`, `migrations.md` and `queries.md` references before editing anything.
- `apps/web/prisma/contract.prisma`: the current schema. Look at `migrations/app/20261120T0805_add_user_role/migration.ts` for how a data transform is written.
- `apps/web/tests/*.test.ts`: the test conventions (vitest, real DB, `vi.mock("server-only")`).

## Context from the SRS (the source documents are not in the repo; this is what matters)

**The 10 Core Virtues** (fixed order):

| # | Virtue | Essence |
|---|---|---|
| 1 | Self-Discipline | Controlling desires, emotions and impulses |
| 2 | Compassion | Feeling others' suffering and acting to relieve it |
| 3 | Responsibility | Accountability for actions, duties and promises |
| 4 | Friendship | Trust, loyalty and support between people |
| 5 | Work | Dignity and satisfaction in honest diligence |
| 6 | Courage | Standing up for what is right despite fear |
| 7 | Perseverance | Persisting through difficulty and delay |
| 8 | Honesty | Truthfulness in word and action |
| 9 | Loyalty | Steadfast devotion to family, friends and principles |
| 10 | Faith | Belief in something higher; hope and reverence (presented pluralistically) |

**Content:**

- **Module (FR-5.4):** one story video with 3–6 interaction points. It has:
  - a source story
  - one primary virtue and up to 2 secondary virtues
  - an age band (8–9 or 10–12)
  - a learning objective
  - discussion prompts for parents/teachers
  - a short real-world follow-up activity
  - a version and a status
- **Journey (FR-5.5):** modules grouped into virtue journeys, with **levels that unlock in sequence**.

**Response capture (FR-6.1):** for every answer, store time taken, number of replays and attempt number, in addition to what is stored today.

**Scoring (FR-6.4 – 6.10):**

- Each answer option is tagged with a weight from **−2 to +2** for one or more virtues.
- **Raw module score** per virtue: weights earned relative to the maximum possible, scaled to 0–100.
- **Running score:** a weighted moving average across modules, with recent modules weighted higher.
- **Composite score:** blends three sources. Defaults: child responses **60%**, parent rating **25%**, teacher rating **15%**.
- **Confidence:** low, medium or high, from the number of scored interactions. Below **8**, show "not enough data yet".
- All weights, thresholds and blend ratios are **versioned**, so every result can be traced to the rule version that produced it.

**Parent and teacher ratings (FR-4.11, 4.12, 4.14):**

- A 5-point rating per virtue, from "needs a lot of support" to "a clear strength".
- A parent marks up to **3 strengths** and up to **3 areas to improve**, with optional notes.
- A teacher can give an optional rating on the same scale.

**SWOT (§6.3, defaults, configurable):**

- **Strengths:** composite ≥ 70 and trend stable or rising.
- **Weaknesses:** composite < 45, OR the parent marked it "area to improve" and the child's score confirms it.
- **Opportunities:** composite between 45 and 70 with a rising trend.
- **Threats:** any of these:
  - the score fell by ≥ 15 points over 3 months
  - there is a large gap between the parent's view and the child's responses
  - an administrator flagged it (ignore this one for the demo)

**Reports:**

- Each quadrant item carries **example responses as evidence** (FR-6.11).
- **The child sees an encouraging version only (FR-6.15):** badges and "superpowers", with **no weaknesses and no numeric scores**.
- Every adult-facing report states it is an educational indicator, not a diagnosis (FR-6.16).

## Scope

### 1. Data model (`contract.prisma` + one migration)

Design the exact fields yourself, following the existing conventions: DB-level CHECKs, composite FKs, `temporal.*` timestamps and text-coded enums. The model must cover the following.

- **Virtue**
  - Fields: stable slug, name, essence, display position 1–10.
  - **Insert the 10 rows in the migration** (a data transform), so every database has them. They are reference data, not demo data.
- **Module**: the SRS metadata on top of an existing `Video`.
  - Make it 1:1 with `Video`. A video without a module must keep working exactly as today: teacher flow, `/watch`, Library.
  - Fields: source story, primary virtue, age band, learning objective, discussion prompts, follow-up activity, version, status (DRAFT | PUBLISHED).
  - Secondary virtues: **at most 2**, never the primary. Enforce this in the DB if practical (for example a join table with position 1–2 unique per module).
- **Journey + journey modules**
  - Journey fields: title, description, focus virtue (optional), display order.
  - Each module in a journey has a **level** (≥ 1) and a position within that level.
  - Unlock logic is app code in Phase 5. Only the data lives here.
- **Option virtue weight**: (option, virtue, weight).
  - Weight is an integer from −2 to +2, non-zero.
  - Unique per (option, virtue).
- **Interaction presentation style**: MORAL_CHOICE | SITUATIONAL | EMOTION | PREDICT | RATING.
  - It is display-only. All of these remain `answerType` CHOICE; a RATING question is 5 ordered options drawn as a slider.
  - Phase 4 renders it; Phase 2 seeds it. Default it so existing interactions are unaffected.
- **Module progress** per (user, module): started time, last position in seconds, completed time.
  - Phase 2 must be able to **backdate** `completedAt`, because trends are built from it.
- **Response capture**: add to `InteractionResponse` the response time (ms), replay count and attempt count. Keep the one-row-per-user latest-wins model; the attempt count increments on re-answer.
  - The existing answer endpoint may leave these at defaults until Phase 4.
- **Rating**: (student user, rater kind PARENT | TEACHER, rater name, virtue, rating 1–5, mark NONE | STRENGTH | IMPROVE, notes, rated at).
  - There are no parent accounts, so the rater is **not** a user FK.
  - Enforce the 1–5 range in the DB. The "max 3 strengths / 3 improve" rule can be app-level.

**Not in this phase's model:**

- branching segments (Phase 4 may add them)
- weight/content version history tables
- schools, classes, consent, assignments

### 2. Scoring & SWOT engine (`apps/web/lib/scoring/`)

- **Pure functions** with no DB, no Next and no I/O. Plain data in, plain data out. This is what lets it move to the HLD's async assessment worker later unchanged.
- **One rules object, `SCORING_RULES_V1`**, holding:
  - version string
  - blend weights
  - confidence thresholds
  - SWOT thresholds
  - recency decay
  - trend window

  Every result carries `ruleVersion`. No admin UI; changing a rule means a new rules object.

- **Rules to implement.** Where the SRS is ambiguous, use these defaults and log them in `decisions.md`:
  - **Raw module score per virtue:**
    - Consider only answered (not skipped) interactions in that module whose options carry a weight for that virtue.
    - `earned` = the sum of the chosen options' weights; `max` and `min` = the sums of the best and worst possible weights.
    - Score = `(earned − min) / (max − min) × 100`.
    - Why this departs from the SRS text: its literal "earned ÷ max" breaks with negative weights, because a neutral (0) answer would score the same as a harmful one. Min–max puts neutral in the middle.
    - A virtue with no weighted interactions in a module gets no score for that module (not 0).
  - **A module counts once it is completed** (`completedAt` set). Its scores are timestamped with `completedAt`.
  - **Running child score:** a recency-weighted average of module scores, with exponential decay per older module (default 0.8). Configurable.
  - **Composite:** parent and teacher ratings map 1–5 → 0–100. Blend 60 / 25 / 15. **If a source is missing, re-normalise the blend over the sources present.**
  - **Confidence** by scored-interaction count:
    - < 8: `insufficient` ("not enough data yet")
    - 8–14: low
    - 15–29: medium
    - ≥ 30: high

    Virtues marked `insufficient` are left out of SWOT.
  - **Trend:** compare the running score now with the score as of 90 days ago.
    - Δ ≥ +5: rising
    - Δ ≤ −5: falling
    - otherwise: stable

    Also return a time series for charts.
  - **SWOT** uses the §6.3 rules above. Additional defaults:
    - "Child's score confirms an area to improve" = child score < 60.
    - "Large parent–child gap" = |parent − child| ≥ 30.
    - Each item returns a plain-language reason and up to 3 evidence response ids. Prefer the strongest positive or negative examples.
    - Return next-step hints (modules to try for weak or opportunity virtues) as virtue ids only; Phase 6 resolves them.
  - **Child view projection:** a separate function. It returns only:
    - superpowers (top virtues, for example the strengths, or the top 3 if there are none)
    - badges earned (define simple rules: per completed module, per journey level, per virtue milestone)
    - star counts

    It must be **structurally impossible to leak numbers or weaknesses**: its return type has no score fields.
- **A thin loader** (`lib/scoring/service.ts`, `server-only`) that reads one user's data from the DB and calls the engine. Compute on read; no caching of child data (decisions.md already forbids caching the user).

### 3. Tests

- Unit tests for the pure engine in `apps/web/tests/scoring.test.ts`, covering at least:
  - neutral answer = 50
  - all-best = 100 / all-worst = 0
  - virtue absent from a module gives no score
  - recency weighting moves the score towards recent modules
  - blend re-normalisation when parent and/or teacher are missing
  - each confidence band, including the `insufficient` exclusion from SWOT
  - each SWOT quadrant rule, including both Weakness paths and both Threat paths
  - `ruleVersion` present
  - the child view has no numeric score fields
- A DB test proving the new constraints reject bad data:
  - weight 3 or 0
  - duplicate (option, virtue)
  - rating 6
  - a 3rd secondary virtue, or primary used as secondary
- Check the migration's virtue seed: exactly 10 rows in the right order.

## Out of scope

- Any page or component
- Demo stories, modules, journeys, users or history (Phase 2)
- Player changes (Phase 4)
- A teacher UI for weights or module metadata
- Admin rule settings
- Branching
- Async workers or queues

## Constraints

- **Migrations: never reset or drop a database.** Use your **dev** database from `apps/web/.env`, never the production Neon database.
- Commit the generated `contract.json` / `contract.d.ts` and the migration snapshot. Never hand-edit snapshots.
- Existing behaviour must not change. All existing tests still pass, and the teacher, watch and library flows work for videos without a module.
- Never print or commit `.env`.

## Done when

- [ ] `contract.prisma` updated, `pnpm --filter web contract:emit` run, and the migration applies cleanly to the dev DB.
- [ ] The 10 virtues exist after migrating.
- [ ] `lib/scoring/` engine plus loader exist, and every rule above is covered by tests.
- [ ] `pnpm typecheck`, `pnpm --filter web lint` and `pnpm --filter web test` all pass.
- [ ] `.claude/memory/architecture.md` describes the new model and the engine location.
- [ ] `.claude/memory/decisions.md` has one entry covering:
  - min–max scoring
  - module counts on completion
  - blend re-normalisation
  - the confidence/trend/SWOT default thresholds
  - rater not being a user FK
  - the child view having no numbers
- [ ] A short summary for the user listing:
  - the new tables
  - the engine API (function names and input/output shapes) that Phases 2, 5 and 6 will use
  - any SRS ambiguity you resolved differently from this prompt, and why
