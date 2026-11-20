# Phase 6: Parent preview

## Where this fits

PARICHAY student demo (web only, student side), 7 phases:

1. Foundation (done)
2. Demo content and seed (done)
3. Student shell and login (done)
4. Interactive player (done; branching skipped)
5. Student pages (done)
6. **Parent preview** ← this phase
7. Polish and deploy

The child's side is complete and deliberately shows no scores (FR-6.15). This phase shows **what the scoring engine actually produces**: the adult-facing assessment report behind a parental gate, inside the demo student's account. It's the part of the demo that answers "so what does PARICHAY tell a parent?"

## Goal

Build `/student/parent` ("For grown-ups") as a **Parent preview**:

- a parental gate in front of it
- a full assessment report for this child: 10-axis radar, per-virtue scores with confidence and trend, a parent/teacher/child comparison, a SWOT with the child's own answers as evidence, next steps, the parent's inputs, and the disclaimer
- printable to PDF
- every view written to an access log

## Read first

- `CLAUDE.md`, `.claude/memory/architecture.md`, `.claude/memory/decisions.md`. Especially:
  - the Phase 1 entry: how scores, confidence, trend and SWOT are computed, plus the defaults
  - the Phase 2 entry: the designed profile, i.e. which virtue lands in which quadrant, so you know what the demo must show
  - the Phase 3 entry: the student shell, the "For grown-ups" link, theme scoping
  - the Phase 5 entry: virtue identity in `lib/virtues/display.ts`; the child-safety rules and test
- `apps/web/AGENTS.md` and the Next.js 16 docs before writing pages, server actions or route handlers. No caching of child data.
- Code to build on:
  - `lib/scoring/service.ts` (`getAssessment`) and `lib/scoring/types.ts`: `Assessment`, `VirtueAssessment` (`childScore`, `parentScore`, `teacherScore`, `compositeScore`, `confidence`, `trend`, `trendDelta`, `series`, `parentMark`), `Swot`, `SwotItem.evidenceResponseIds`, `nextStepVirtueIds`, `disclaimer`, `ruleVersion`
  - `lib/learning/` (modules and journeys, for next steps)
  - `lib/virtues/display.ts`
  - `components/student/StudentPlaceholder.tsx`, which this phase replaces for `/student/parent`
  - `tests/student-pages.test.ts`: the Phase 5 child-safety check, which must keep passing
- If a data-visualisation skill is available in your session, load it before drawing any chart.

## Context from the SRS

**The report (FR-6.11 – 6.16):**

- **FR-6.11:** each SWOT quadrant has **plain-language explanations written for parents**, with **example responses from the child as evidence**.
- **FR-6.12:** a **10-axis radar** of current scores, a **trend over time per virtue**, and a **comparison of the parent, teacher and child views**.
- **FR-6.13:** next steps: modules to try, home activities, discussion questions. Suggest relevant **expert categories only for persistent weaknesses or threats**.
- **FR-6.14:** reports export to PDF.
- **FR-6.16:** every report states clearly that it is an **educational indicator, not a psychological or medical diagnosis**.

**Scoring display:**

- **FR-6.8:** confidence is shown per virtue. Fewer than 8 scored interactions → **"not enough data yet"**.
- **FR-6.10:** every report can be traced to the rule version that produced it.

**Parent inputs:**

- **FR-4.11 – 4.13:** the parent's 1–5 ratings and strength/improve marks. Past versions are kept for comparison.

**Access and audit:**

- **§3:** parent features inside the child's app sit behind a PIN-protected "Parent Zone".
- **NFR-9.3:** a parental gate goes in front of anything not meant for the child.
- **FR-7.14 / NFR-9.10 / HLD §7:** every child-report access is logged: who, which student, what, when.

**Expert categories (FR-7.1):** Health/Paediatrics, Yoga, Meditation/Mindfulness, Child Psychology/Counselling, Child Psychiatry, NLP Coaching, Sports Coaching, Nutrition.

## Decisions already made (don't revisit)

- **It lives inside the student account.** There are no parent accounts in this demo. Label it clearly as a **"Parent preview"** of this child's report. The real product has a separate parent dashboard; say so in a small note.
- **It's read-only.** There's no UI for entering parent ratings; they come from the seed.
- **No expert marketplace.** Suggested expert categories are text only, with no booking.

## Scope

### 1. Parental gate

- **Before anything is shown,** `/student/parent` asks a grown-up check: a randomly chosen multiplication question (two numbers from 6–12), answered on a number pad. Phase 3's `PinPad` may be reusable.
- **The server issues and checks the question,** for example through a server action with the expected answer kept server-side. The browser never gets the answer.
- **A pass is stored on the session**, for example `Session.parentGateUntil` (one small migration), valid for about 15 minutes. It can't be forged by editing a cookie, and it ends at logout.
- **The report data is loaded only after the server confirms the gate.** Before that, the page HTML must contain none of it.
- **Wrong answers:** a new question each time, and a cooldown after a few tries.
- **This is a gate against children wandering in, not access control.** Access control is still `requireStudent` plus "it's the child's own data". Log that reasoning in `decisions.md`.
- **A "Back to Aarav's app" button** ends the gate early.

### 2. Report loader (server)

Add one function, for example `getParentReport(userId)` in a new `lib/reports/` (`server-only`). It wraps `getAssessment` and resolves everything the page needs in a small, fixed number of queries:

- **Child:** name, avatar, stories finished, last active date.
- **Per-virtue rows** in fixed virtue order:
  - composite, child, parent and teacher scores
  - confidence
  - trend and delta
  - series
  - parent mark and notes
- **SWOT items with evidence resolved:**
  - for each response id: story title, question text, **the child's chosen answer text**, and the date
  - **only this student's responses**; check ownership, never trust the ids blindly
- **Next steps** from `nextStepVirtueIds`:
  - up to about 3 modules to try (prefer not-yet-completed), with their `followUpActivity` as home activities
  - discussion questions from `discussionPrompts` of related modules
  - expert categories only for virtues that are a weakness **and** also a threat or a weakness on the previous rating set, i.e. "persistent". Use a static virtue → category map with a short reason.
- **Parent inputs:** the latest ratings and marks, plus the previous set with what changed (FR-4.13).
- **`ruleVersion`, `asOf`, `disclaimer`** taken from the assessment as-is.

### 3. Access log

- **A minimal `AuditLog` table** (in the same migration as the gate column): actor user, action (for example `REPORT_VIEW`, `REPORT_PRINT`), subject student, time. No IP address; that's data minimisation.
- **Write a row** every time the report is shown after the gate, and when print is used.
- **Show a small "Who viewed this report" list** (the last ~10 entries) at the bottom. This is the HLD/SRS audit story made visible.

### 4. The report page

Use the standard app look (theme tokens), not the bright child theme: it's for adults. It must stay readable in light and dark mode and at 360 px wide.

1. **Header:**
   - "Parent preview: Aarav's PARICHAY report"
   - avatar, as-of date, rule version
   - **the disclaimer, prominent**, not in a footer
2. **Summary:** stories finished, last active, a sentence on how much data there is, and the top strengths in one plain sentence.
3. **Radar (FR-6.12):**
   - 10 axes in fixed virtue order
   - composite score as the main shape, with parent and teacher views as overlays the reader can turn on and off
   - **Virtues with "not enough data yet" are not plotted as 0.** Show their axis as empty or hollow, with the label.
   - Draw it with hand-built SVG, or a charting library added with pnpm if you prefer. Either way, provide a **table alternative** for screen readers and print.
4. **Virtue cards (one per virtue, fixed order):**
   - composite score
   - confidence badge
   - trend arrow and change over 90 days
   - a sparkline of the series
   - small child / parent / teacher bars, flagging a big gap (≥ 30, per the rules)
   - virtue icon and colour from `lib/virtues/display.ts`; series distinguished by pattern as well as colour (colour-blind-safe)
5. **SWOT:** four quadrants. Each item has:
   - virtue, plain-language reason (rewrite the engine's `reason` for parents where it reads like a rule)
   - expandable evidence: "In *The Tortoise and the Hare*, when asked '…', Aarav chose '…'"
   - neutral, non-blaming wording ("still developing", never "bad at")
   - empty quadrants say so plainly
6. **Next steps:** stories to try (links into the student module pages), activities to do at home, questions to talk about together, and expert categories (only where the rule above applies), worded carefully ("you might consider talking to…").
7. **Parent inputs:** the latest ratings and marks next to the child's scores; the earlier rating set and what changed.
8. **Trend over time:** pick a virtue to see its score after each story finished, with dates.
9. **Access log** (from section 3).
10. **Print / Save as PDF:** a button that calls `window.print()`.
    - A print stylesheet hides the shell, gate and buttons, keeps charts visible, avoids splitting cards across pages, and puts the disclaimer and rule version on the first page.
    - Log the print.

### 5. Tests

- **Gate:**
  - the page and loader refuse without a gate pass (none of the report data in the response)
  - a wrong answer is refused, with a cooldown after repeated tries
  - a right answer opens it
  - the pass expires and ends at logout
  - the answer never appears in what the browser receives
- **Report for Aarav after `demo:reset`** (the designed profile):
  - every SWOT quadrant has its expected virtue(s)
  - the "not enough data" virtue has no plotted score
  - the disclaimer and `ruleVersion` are present
- **Evidence:** resolves to this student's own answers only. Seed a second student's response and give its id to the resolver: it must be ignored.
- **Expert categories:** appear only under the persistence rule.
- **Audit:** one row per report view and per print, with no IP stored.
- **Access:** a teacher is redirected.
- **Child pages are unaffected:** the Phase 5 child-safety test still passes and still covers every other student loader. Exclude only the parent report on purpose, with a comment saying why.

## Out of scope

- Parent accounts, a parent dashboard, multiple children
- Entering or editing parent or teacher ratings
- Teacher or school reports
- The expert marketplace, booking and consent sharing
- Safeguarding alerts (FR-6.17)
- Server-side PDF generation (browser print is enough)
- Age-band norms

## Constraints

- Never reset or drop a database; migrate the **dev** database only.
- **Don't change the scoring engine or `SCORING_RULES_V1`.** This phase only displays them.
- Nothing from this report may appear on any child page.
- No caching of child data. After manual testing, run `pnpm --filter web demo:reset --yes` (and check whether it should also clear the gate state and audit rows for the demo student; decide and document).

## Done when

- [ ] As Aarav: "For grown-ups" → gate → the report shows all four SWOT quadrants with real evidence, the radar with Faith shown as "not enough data yet", trends, the parent/teacher/child comparison, next steps and parent inputs, all under the disclaimer.
- [ ] Print / Save as PDF produces a clean multi-page report.
- [ ] The access log lists the views.
- [ ] "Back to Aarav's app" returns to the child view, and the gate is needed again.
- [ ] It works at 360 px and in dark mode, and loads in under 3 s on the dev database.
- [ ] `pnpm typecheck`, `pnpm --filter web lint` and `pnpm --filter web test` pass.
- [ ] `.claude/memory/architecture.md` updated: the parent preview route, gate storage, `lib/reports/`, `AuditLog`, and what `demo:reset` does with them. Remove the line saying `/student/parent` is a placeholder.
- [ ] `.claude/memory/decisions.md` has an entry covering:
  - why the preview lives in the student account
  - the gate is a child gate, not access control, and why it's stored on the session
  - "not enough data" is never plotted as 0
  - the expert-category persistence rule
  - no IP in the audit log
- [ ] A short summary for the user: the click-path for the demo, what each report section shows for Aarav, and anything the engine's output made awkward to present (for example reasons that needed rewording).
