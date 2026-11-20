import { describe, expect, it } from "vitest";
import { isModuleUnlocked, nextModuleAfter, replayStart, resumePosition, unlockedModuleIds, type JourneyPlacement } from "@/lib/learning/rules";

const P = (journeyId: number, moduleId: number, level: number, position = 0): JourneyPlacement => ({ journeyId, moduleId, level, position });

describe("unlock rule", () => {
  // Journey 1: level 1 = {1, 2}, level 2 = {3}.   Journey 2: level 1 = {4}, level 2 = {2, 5}  (module 2 is in both).
  const placements = [P(1, 1, 1, 0), P(1, 2, 1, 1), P(1, 3, 2), P(2, 4, 1), P(2, 2, 2, 0), P(2, 5, 2, 1)];

  it("level 1 is always open, level 2 is locked until level 1 is complete", () => {
    expect([...unlockedModuleIds(placements, new Set())].sort()).toEqual([1, 2, 4]);
    expect(isModuleUnlocked(3, placements, new Set())).toBe(false);
    expect(isModuleUnlocked(3, placements, new Set([1]))).toBe(false); // every module of level 1, not just one
    expect(isModuleUnlocked(3, placements, new Set([1, 2]))).toBe(true);
  });

  it("a module in two journeys is open if it is open in either", () => {
    // Module 2 is level 2 of journey 2 (locked there) but level 1 of journey 1 (open): open.
    expect(isModuleUnlocked(2, placements, new Set())).toBe(true);
    // Module 5 only lives in journey 2 level 2: needs module 4 done.
    expect(isModuleUnlocked(5, placements, new Set())).toBe(false);
    expect(isModuleUnlocked(5, placements, new Set([4]))).toBe(true);
  });

  it("a module in no journey stands alone and is open", () => {
    expect(isModuleUnlocked(99, placements, new Set())).toBe(true);
  });

  it("picks the next open, unfinished module after this one", () => {
    expect(nextModuleAfter(1, placements, new Set([1]), [1, 2])).toEqual({ journeyId: 1, moduleId: 2 });
    expect(nextModuleAfter(2, placements, new Set([1, 2]), [1, 2])).toEqual({ journeyId: 1, moduleId: 3 });
    // Level 2 is still locked: nothing next, the caller sends the child back to the journey.
    expect(nextModuleAfter(4, [P(2, 4, 1), P(2, 5, 2)], new Set(), [2])).toBeNull();
    expect(nextModuleAfter(4, [P(2, 4, 1), P(2, 5, 2)], new Set([4]), [2])).toEqual({ journeyId: 2, moduleId: 5 });
    expect(nextModuleAfter(3, placements, new Set([1, 2, 3]), [1])).toBeNull();
  });
});

describe("resume position", () => {
  const qs = [
    { id: 1, timestamp: 30, isSkippable: false },
    { id: 2, timestamp: 90, isSkippable: false },
    { id: 3, timestamp: 150, isSkippable: true },
  ];

  it("resumes where the child stopped", () => {
    expect(resumePosition(100, 300, qs, new Set([1, 2]), false)).toBe(100);
    expect(resumePosition(0, 300, qs, new Set(), false)).toBe(0);
  });

  it("goes back to an unanswered required question that sits before the saved position", () => {
    expect(resumePosition(100, 300, qs, new Set([1]), false)).toBe(90);
    expect(resumePosition(200, 300, qs, new Set(), false)).toBe(30);
  });

  it("ignores skippable questions and questions after the saved position", () => {
    expect(resumePosition(200, 300, qs, new Set([1, 2]), false)).toBe(200);
    expect(resumePosition(40, 300, qs, new Set([1]), false)).toBe(40);
  });

  it("a finished or fully watched module starts from the beginning", () => {
    expect(resumePosition(120, 300, qs, new Set([1, 2]), true)).toBe(0);
    expect(resumePosition(299.5, 300, qs, new Set([1, 2]), false)).toBe(0);
  });
});

describe("replay start", () => {
  const qs = [{ timestamp: 30 }, { timestamp: 90 }, { timestamp: 90 }, { timestamp: 150 }];
  it("replays from the previous question, or from 0 for the first", () => {
    expect(replayStart(30, qs)).toBe(0);
    expect(replayStart(90, qs)).toBe(30);
    expect(replayStart(150, qs)).toBe(90);
  });
});
