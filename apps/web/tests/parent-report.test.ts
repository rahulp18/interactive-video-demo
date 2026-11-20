import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { canAccessPath } from "@/lib/auth/roles";
import { createSession, hashToken, revokeSession } from "@/lib/auth/session";
import { GateClosedError, openParentReport } from "@/lib/reports/access";
import { logReportAccess, recentReportAccess } from "@/lib/reports/audit";
import { endGate, getChallenge, hasGatePass, submitAnswer } from "@/lib/reports/gate";
import { GATE, evaluateAttempt, gateIsOpen, makeChallenge } from "@/lib/reports/gate-rules";
import {
  EXPERTS_BY_VIRTUE,
  describeParentChange,
  isPersistentWeakness,
  parentReason,
  plottedComposite,
  ratingsBeforeLatestSet,
} from "@/lib/reports/report-rules";
import { getParentReport, resolveEvidence } from "@/lib/reports/service";
import { SCORING_RULES_V1 } from "@/lib/scoring/rules";
import type { RatingInput, VirtueAssessment } from "@/lib/scoring/types";
import { VIRTUE_SLUGS } from "@/lib/virtues/display";
import { db } from "@/prisma/db";
import { ensureAccounts, resetStudent, seedContent, seedJourneys } from "@/scripts/demo/seed-lib";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("uploadthing/server", () => ({ UTApi: class { deleteFiles = async () => ({}); } }));

const MINUTE = 60_000;

// ------------------------------------------------------------------ pure

describe("parental gate rules (pure)", () => {
  it("makes a multiplication of two numbers from 6 to 12", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const c = makeChallenge((min, maxExclusive) => min + Math.floor(Math.random() * (maxExclusive - min)));
      const [a, b] = c.text.split(" × ").map(Number);
      for (const n of [a, b]) {
        expect(n).toBeGreaterThanOrEqual(6);
        expect(n).toBeLessThanOrEqual(12);
        seen.add(n);
      }
      expect(c.answer).toBe(a * b);
    }
    expect(seen.size).toBe(7);
  });

  it("a wrong answer counts, the third starts a cooldown, and a locked gate refuses even a right answer", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    let state = { failures: 0, lockedUntil: null as Date | null, answer: 56 as number | null };
    const first = evaluateAttempt(state, 55, now);
    expect(first).toMatchObject({ kind: "wrong", failures: 1, lockedUntil: null });
    state = { ...state, failures: 2 };
    const third = evaluateAttempt(state, 1, now);
    expect(third.kind).toBe("wrong");
    if (third.kind !== "wrong") throw new Error("unreachable");
    expect(third.lockedUntil?.getTime()).toBe(now.getTime() + GATE.lockMs);
    const locked = { failures: 0, lockedUntil: third.lockedUntil, answer: 56 };
    expect(evaluateAttempt(locked, 56, new Date(now.getTime() + 1000)).kind).toBe("locked");
    // once the cooldown is over a right answer works, and a wrong one starts counting from 1 again
    const after = new Date(now.getTime() + GATE.lockMs + 1);
    expect(evaluateAttempt(locked, 56, after).kind).toBe("passed");
    expect(evaluateAttempt(locked, 1, after)).toMatchObject({ kind: "wrong", failures: 1 });
  });

  it("a pass is open only until it expires", () => {
    const now = new Date("2026-11-20T10:00:00Z");
    expect(gateIsOpen(null, now)).toBe(false);
    expect(gateIsOpen(new Date(now.getTime() + MINUTE), now)).toBe(true);
    expect(gateIsOpen(new Date(now.getTime() - 1), now)).toBe(false);
    expect(GATE.passMs).toBe(15 * MINUTE);
  });
});

describe("report rules (pure)", () => {
  it("an expert category needs a weakness that is ALSO a threat or was a weakness before", () => {
    const now = { weaknesses: [1, 2, 3], threats: [2] };
    expect(isPersistentWeakness(1, now, [])).toBe(false); // weak once only
    expect(isPersistentWeakness(2, now, [])).toBe(true); // weak and a threat
    expect(isPersistentWeakness(3, now, [3])).toBe(true); // weak before too
    expect(isPersistentWeakness(4, { weaknesses: [], threats: [4] }, [4])).toBe(false); // not a weakness now
    expect(Object.keys(EXPERTS_BY_VIRTUE).sort()).toEqual([...VIRTUE_SLUGS].sort());
  });

  it("'not enough data yet' is never plotted, not even as 0", () => {
    expect(plottedComposite({ confidence: "insufficient", composite: 75 })).toBeNull();
    expect(plottedComposite({ confidence: "low", composite: 0 })).toBe(0);
    expect(plottedComposite({ confidence: "high", composite: null })).toBeNull();
  });

  const rating = (kind: "PARENT" | "TEACHER", day: string, virtueId = 1, value = 3): RatingInput => ({
    raterKind: kind,
    virtueId,
    rating: value,
    mark: "NONE",
    ratedAt: new Date(`${day}T09:00:00Z`),
  });

  it("the 'before' rating set drops the newest set of a kind that has two, and keeps a lone set", () => {
    const all = [rating("PARENT", "2026-08-01"), rating("PARENT", "2026-11-14"), rating("PARENT", "2026-11-14", 2), rating("TEACHER", "2026-11-08")];
    const before = ratingsBeforeLatestSet(all);
    expect(before.filter((r) => r.raterKind === "PARENT")).toHaveLength(1);
    expect(before.filter((r) => r.raterKind === "TEACHER")).toHaveLength(1);
  });

  it("describes what changed between two parent ratings", () => {
    expect(describeParentChange({ rating: 4, mark: "NONE" }, { rating: 4, mark: "NONE" })).toBeNull();
    expect(describeParentChange({ rating: 4, mark: "NONE" }, { rating: 2, mark: "NONE" })).toBe("Rating went from 2 to 4");
    expect(describeParentChange({ rating: 3, mark: "IMPROVE" }, { rating: 3, mark: "NONE" })).toMatch(/now marked as something to work on/);
    expect(describeParentChange(null, { rating: 3, mark: "NONE" })).toBeNull();
  });

  it("wording for parents is neutral and never reads like a rule", () => {
    const v = { compositeScore: 30, trend: "stable", trendDelta: null, parentScore: null, childScore: 30 } as unknown as VirtueAssessment;
    for (const quadrant of ["strength", "weakness", "opportunity", "threat"] as const) {
      const text = parentReason({ quadrant }, v, "Honesty", "Aarav", SCORING_RULES_V1);
      expect(text).not.toMatch(/\bbad\b|\bpoor\b|\bfail|composite|on the low side|\brule\b/i);
    }
    expect(parentReason({ quadrant: "weakness" }, v, "Honesty", "Aarav", SCORING_RULES_V1)).toMatch(/still developing/);
  });
});

// ------------------------------------------------------------------ database

describe("parent preview against the database", () => {
  const throwaway: number[] = [];
  const videos: number[] = [];
  let aaravId = 0;
  let aaravToken = "";
  let other = { id: 0, token: "" };
  let teacherId = 0;
  const password = process.env["DEMO_PASSWORD"] && process.env["DEMO_PASSWORD"]!.length >= 8 ? process.env["DEMO_PASSWORD"]! : randomUUID();

  async function makeUser(label: string, role: "STUDENT" | "TEACHER") {
    const u = await db.orm.public.User.create({ name: label, email: `${label}-${randomUUID()}@example.com`, password: "x", role });
    throwaway.push(u.id);
    return { id: u.id, token: (await createSession(u.id)).token };
  }

  /** The tests read the pending answer straight from the database: the browser never gets it. */
  async function pendingAnswer(token: string): Promise<number> {
    const row = await db.orm.public.Session.where({ tokenHash: hashToken(token) }).first();
    if (row?.parentGateAnswer == null) throw new Error("no pending question");
    return row.parentGateAnswer;
  }
  const clearAudit = () => db.orm.public.AuditLog.where({ subjectId: aaravId }).deleteAll();

  beforeAll(async () => {
    const ids = await ensureAccounts(password);
    aaravId = ids.student;
    const content = await seedContent(ids.content);
    await seedJourneys(content.moduleIds);
    await resetStudent(aaravId);
    aaravToken = (await createSession(aaravId)).token;
    other = await makeUser("report-other", "STUDENT");
    teacherId = (await makeUser("report-teacher", "TEACHER")).id;
  }, 300_000);

  afterAll(async () => {
    await revokeSession(aaravToken);
    for (const id of videos) await db.orm.public.Video.where({ id }).deleteAll();
    for (const id of throwaway) await db.orm.public.User.where({ id }).deleteAll();
    await resetStudent(aaravId); // designed state, empty access log, closed gate
  }, 120_000);

  describe("the gate", () => {
    it("refuses the report and the loader without a pass, and writes nothing to the log", async () => {
      await clearAudit();
      expect(await hasGatePass(aaravToken)).toBe(false);
      await expect(openParentReport(aaravId, aaravToken)).rejects.toBeInstanceOf(GateClosedError);
      expect(await db.orm.public.AuditLog.where({ subjectId: aaravId }).all()).toHaveLength(0);
    });

    it("never sends the answer to the browser, and a wrong answer gets a new question", async () => {
      const q = await getChallenge(aaravToken);
      expect(q.status).toBe("question");
      if (q.status !== "question") throw new Error("unreachable");
      expect(Object.keys(q).sort()).toEqual(["status", "text"]);
      const answer = await pendingAnswer(aaravToken);
      expect(q.text).not.toContain(String(answer));
      expect(await getChallenge(aaravToken)).toEqual(q); // reloading keeps the same question

      const wrong = await submitAnswer(aaravToken, answer + 1);
      expect(wrong.status).toBe("wrong");
      expect(Object.keys(wrong).sort()).toEqual(["status", "text"]);
      expect(await hasGatePass(aaravToken)).toBe(false);
    });

    it("locks after repeated wrong answers, refuses even a right one, then recovers", async () => {
      const t0 = new Date();
      let last = await submitAnswer(aaravToken, -1, t0); // 2nd wrong (1st was in the previous test)
      expect(last.status).toBe("wrong");
      last = await submitAnswer(aaravToken, -1, t0); // 3rd
      expect(last.status).toBe("locked");
      if (last.status !== "locked") throw new Error("unreachable");
      expect(last.retryAfterSeconds).toBeGreaterThan(0);
      expect(last.retryAfterSeconds).toBeLessThanOrEqual(GATE.lockMs / 1000);
      expect((await getChallenge(aaravToken, t0)).status).toBe("locked");
      expect((await submitAnswer(aaravToken, 56, t0)).status).toBe("locked");

      const later = new Date(t0.getTime() + GATE.lockMs + 1000);
      const q = await getChallenge(aaravToken, later);
      expect(q.status).toBe("question");
    });

    it("a right answer opens it, the pass expires, and Back ends it early", async () => {
      const now = new Date(Date.now() + GATE.lockMs + 5000); // past any cooldown from the previous test
      await getChallenge(aaravToken, now);
      expect((await submitAnswer(aaravToken, await pendingAnswer(aaravToken), now)).status).toBe("open");
      expect(await hasGatePass(aaravToken, now)).toBe(true);
      expect(await hasGatePass(aaravToken, new Date(now.getTime() + GATE.passMs - 1000))).toBe(true);
      expect(await hasGatePass(aaravToken, new Date(now.getTime() + GATE.passMs + 1000))).toBe(false);

      await endGate(aaravToken);
      expect(await hasGatePass(aaravToken, now)).toBe(false);
      expect((await getChallenge(aaravToken, now)).status).toBe("question"); // needed again
    });

    it("a pass belongs to one session and ends at logout", async () => {
      const mine = (await createSession(aaravId)).token;
      const now = new Date(Date.now() + 2 * GATE.lockMs);
      await getChallenge(mine, now);
      await submitAnswer(mine, await pendingAnswer(mine), now);
      expect(await hasGatePass(mine, now)).toBe(true);
      expect(await hasGatePass(aaravToken, now)).toBe(false); // another session of the same child
      await revokeSession(mine);
      expect(await hasGatePass(mine, now)).toBe(false);
    });

    it("an unknown token never passes", async () => {
      expect(await hasGatePass("not-a-token")).toBe(false);
      expect((await submitAnswer("not-a-token", 1)).status).toBe("locked");
    });
  });

  describe("the report for the demo student", () => {
    it("shows the designed profile in the right quadrants", async () => {
      const report = await getParentReport(aaravId);
      const slugs = (items: { slug: string }[]) => items.map((i) => i.slug).sort();
      expect(slugs(report.swot.strengths)).toEqual(["compassion", "friendship", "loyalty"]);
      expect(slugs(report.swot.weaknesses)).toEqual(["honesty", "self-discipline"]);
      expect(slugs(report.swot.opportunities)).toEqual(["perseverance"]);
      expect(slugs(report.swot.threats)).toEqual(["responsibility", "work"]);
      expect(report.virtues.map((v) => v.slug)).toEqual([...VIRTUE_SLUGS]);
    });

    it("Faith is 'not enough data yet' with no plotted score", async () => {
      const faith = (await getParentReport(aaravId)).virtues.find((v) => v.slug === "faith")!;
      expect(faith.confidence).toBe("insufficient");
      expect(faith.child).toBeNull();
      expect(faith.composite).toBeNull();
      expect(plottedComposite(faith)).toBeNull();
    });

    it("carries the disclaimer and the rule version, and summarises the data", async () => {
      const report = await getParentReport(aaravId);
      expect(report.ruleVersion).toBe(SCORING_RULES_V1.version);
      expect(report.disclaimer).toMatch(/not a (psychological|medical)|diagnosis/i);
      expect(report.child.name).toBe("Aarav");
      expect(report.child.storiesFinished).toBe(8);
      expect(report.summary.dataSentence).toMatch(/not enough data yet/i);
      expect(report.summary.strengthsSentence).toMatch(/Compassion/);
    });

    it("every SWOT item with example answers shows this student's own answers, in words", async () => {
      const report = await getParentReport(aaravId);
      const items = Object.values(report.swot).flat();
      expect(items.some((i) => i.evidence.length > 0)).toBe(true);
      const own = new Set((await db.orm.public.InteractionResponse.where({ userId: aaravId }).all()).map((r) => r.id));
      for (const item of items)
        for (const e of item.evidence) {
          expect(own.has(e.responseId)).toBe(true);
          expect(e.story.length).toBeGreaterThan(3);
          expect(e.question).toMatch(/\?|\.|…/);
          expect(e.answer.length).toBeGreaterThan(0);
        }
    });

    it("suggests expert categories only for persistent weaknesses, as text", async () => {
      const report = await getParentReport(aaravId);
      const weakIds = new Set(report.swot.weaknesses.map((w) => w.virtueId));
      for (const e of report.nextSteps.experts) {
        expect(weakIds.has(e.virtueId)).toBe(true);
        expect(e.categories.length).toBeGreaterThan(0);
      }
      // Self-Discipline: a weakness now, and also on the earlier rating set (parent rated it 2/5 then, too).
      expect(report.nextSteps.experts.map((e) => e.virtueName)).toContain("Self-Discipline");
      // Never for a strength, an opportunity or "not enough data".
      const notWeak = [...report.swot.strengths, ...report.swot.opportunities].map((i) => i.name);
      for (const name of notWeak) expect(report.nextSteps.experts.map((e) => e.virtueName)).not.toContain(name);
    });

    it("next steps: up to 3 stories (links need real ids), activities and questions", async () => {
      const { nextSteps } = await getParentReport(aaravId);
      expect(nextSteps.stories.length).toBeGreaterThan(0);
      expect(nextSteps.stories.length).toBeLessThanOrEqual(3);
      for (const s of nextSteps.stories) expect(s.activity.length).toBeGreaterThan(10);
      expect(nextSteps.questions.length).toBeGreaterThan(0);
    });

    it("parent inputs show the latest set next to the earlier one, and what changed", async () => {
      const { parentInputs } = await getParentReport(aaravId);
      expect(parentInputs.latestSetAt).not.toBeNull();
      expect(parentInputs.previousSetAt).not.toBeNull();
      const compassion = parentInputs.rows.find((r) => r.slug === "compassion")!;
      expect(compassion.latest?.rating).toBe(5);
      expect(compassion.previous?.rating).toBe(4);
      expect(compassion.change).toBe("Rating went from 4 to 5");
      expect(parentInputs.rows.find((r) => r.slug === "honesty")!.latest?.notes).toMatch(/want to hear/);
    });

    it("a student with no history gets an honest, empty report", async () => {
      const report = await getParentReport(other.id);
      expect(report.child.storiesFinished).toBe(0);
      expect(report.virtues.every((v) => v.confidence === "insufficient")).toBe(true);
      expect(Object.values(report.swot).flat()).toEqual([]);
      expect(report.nextSteps.experts).toEqual([]);
      expect(report.summary.dataSentence).toMatch(/not enough data yet/i);
    });
  });

  describe("evidence ownership", () => {
    it("ignores response ids that belong to someone else", async () => {
      const mine = await db.orm.public.InteractionResponse.where({ userId: aaravId }).first();
      expect(mine).not.toBeNull();
      // A second student answers the same question; Aarav's resolver is handed THAT id.
      const option = await db.orm.public.InteractionOption.where({ id: mine!.selectedOptionId! }).first();
      const theirs = await db.orm.public.InteractionResponse.create({
        userId: other.id,
        interactionId: option!.interactionId,
        selectedOptionId: option!.id,
      });
      const onlyTheirs = await resolveEvidence(aaravId, [theirs.id]);
      expect(onlyTheirs.size).toBe(0);
      const both = await resolveEvidence(aaravId, [theirs.id, mine!.id]);
      expect([...both.keys()]).toEqual([mine!.id]);
      // ...and the other way round: it resolves for its owner.
      expect((await resolveEvidence(other.id, [theirs.id])).size).toBe(1);
      await db.orm.public.InteractionResponse.where({ id: theirs.id }).deleteAll();
    });

    it("unknown or empty ids resolve to nothing", async () => {
      expect((await resolveEvidence(aaravId, [])).size).toBe(0);
      expect((await resolveEvidence(aaravId, [2_000_000_000])).size).toBe(0);
    });
  });

  describe("the access log", () => {
    it("writes one row per view and per print, with no IP address", async () => {
      await clearAudit();
      const now = new Date(Date.now() + 5 * GATE.lockMs);
      await getChallenge(aaravToken, now);
      await submitAnswer(aaravToken, await pendingAnswer(aaravToken), now);

      const first = await openParentReport(aaravId, aaravToken);
      expect(first.access.map((a) => a.action)).toEqual(["REPORT_VIEW"]);
      await openParentReport(aaravId, aaravToken);
      await logReportAccess(aaravId, aaravId, "REPORT_PRINT");

      const rows = await db.orm.public.AuditLog.where({ subjectId: aaravId }).all();
      expect(rows.filter((r) => r.action === "REPORT_VIEW")).toHaveLength(2);
      expect(rows.filter((r) => r.action === "REPORT_PRINT")).toHaveLength(1);
      expect(Object.keys(rows[0]).sort()).toEqual(["action", "actorId", "at", "id", "subjectId"]);

      const log = await recentReportAccess(aaravId, 10);
      expect(log).toHaveLength(3);
      expect(log[0].at.getTime()).toBeGreaterThanOrEqual(log[2].at.getTime()); // newest first
      expect(log.every((l) => l.actorName === "Aarav" || l.actorName.length > 0)).toBe(true);
      await endGate(aaravToken);
    });

    it("the database refuses an unknown action", async () => {
      await expect(db.orm.public.AuditLog.create({ actorId: aaravId, subjectId: aaravId, action: "DELETE_EVERYTHING" })).rejects.toThrow();
    });
  });

  it("teachers cannot open the parent preview", () => {
    expect(canAccessPath("TEACHER", "/student/parent")).toBe(false);
    expect(canAccessPath("STUDENT", "/student/parent")).toBe(true);
    expect(teacherId).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ child pages stay clear of the report

describe("the parent report stays off the child's pages", () => {
  // tests/student-pages.test.ts scans every child-facing loader for score / weakness / threat keys. The parent report
  // is the ONE loader left out of that scan on purpose: it exists to show exactly those things, to an adult behind the
  // gate. This test makes sure nothing child-facing can pull it in.
  const root = join(__dirname, "..");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
    });

  it("no child-facing file imports lib/reports or the parent components", () => {
    const childDirs = ["lib/learning", "lib/student", "components/student", "components/player", "app/(app)/student", "app/api/student"];
    const offenders = childDirs
      .flatMap((d) => walk(join(root, d)))
      .filter((f) => !relative(root, f).replace(/\\/g, "/").match(/^(components\/student\/parent\/|app\/\(app\)\/student\/parent\/)/))
      .filter((f) => /lib\/reports|student\/parent\//.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });
});
