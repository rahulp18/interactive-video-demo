// Pure rules for the student pages (no I/O, tested). Anything that decides what a child is told lives here.
import type { ChildBadge } from "@/lib/scoring/types";
import { isModuleUnlocked, type JourneyPlacement } from "./rules";
import type { ModuleStatus, TreeStage } from "./overview-types";

/** Fraction of the video watched, 0..1, rounded to two decimals; 0 when it cannot be known. */
export function watchedFraction(positionSeconds: number, duration: number): number {
  if (!(duration > 0) || !(positionSeconds > 0)) return 0;
  return Math.round(Math.min(1, positionSeconds / duration) * 100) / 100;
}

/** Status of one module for one student. */
export function moduleStatus(
  moduleId: number,
  placements: readonly JourneyPlacement[],
  completed: ReadonlySet<number>,
  started: ReadonlySet<number>,
): ModuleStatus {
  if (completed.has(moduleId)) return "completed";
  if (!isModuleUnlocked(moduleId, placements, completed)) return "locked";
  return started.has(moduleId) ? "in-progress" : "ready";
}

export type UpNextCandidate = { moduleId: number; primaryVirtueId: number; journeyOrder: number; level: number; position: number };

/**
 * The best unlocked, unstarted module. Prefers modules whose primary virtue is in `focusVirtueIds` (the engine's
 * "next step" virtues, most useful first), then journey order. The caller never tells the child why.
 */
export function pickUpNext(candidates: readonly UpNextCandidate[], focusVirtueIds: readonly number[]): number | null {
  const rank = (id: number) => {
    const i = focusVirtueIds.indexOf(id);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  const sorted = [...candidates].sort((a, b) => {
    const ra = rank(a.primaryVirtueId);
    const rb = rank(b.primaryVirtueId);
    if (ra !== rb) return ra < rb ? -1 : 1; // not subtraction: Infinity - Infinity is NaN
    return a.journeyOrder - b.journeyOrder || a.level - b.level || a.position - b.position;
  });
  return sorted[0]?.moduleId ?? null;
}

/** Tree growth comes from TOTAL stars only (never from one virtue's stars). */
export const TREE_STAGE_STARS = { young: 12, full: 35 } as const;
export function treeStage(totalStars: number): TreeStage {
  return totalStars >= TREE_STAGE_STARS.full ? "full" : totalStars >= TREE_STAGE_STARS.young ? "young" : "sapling";
}

/** Leaves drawn on a branch for its stars. */
export const MAX_LEAVES = 6;
export const leavesFor = (stars: number) => Math.max(0, Math.min(MAX_LEAVES, Math.floor(stars)));
/** A blossom opens once a branch has a few stars. A bud is always drawn, so every branch shows growth. */
export const hasBlossom = (stars: number) => stars >= 5;

/** Child wording for the engine's badge titles. Story badges name the story. */
export function childBadgeTitle(badge: ChildBadge, storyTitles: ReadonlyMap<number, string>, virtueNames: ReadonlyMap<number, string>): string {
  if (badge.kind === "module") {
    const title = storyTitles.get(Number(badge.id.split(":")[1]));
    return title ? `Finished: ${title}` : "Story finished";
  }
  if (badge.kind === "journey-level") {
    const level = badge.id.split(":")[2];
    return `${badge.title.replace(/: level \d+ complete$/, "")}, level ${level} done!`;
  }
  const milestone = badge.id.split(":")[2];
  const name = badge.virtueId !== null ? virtueNames.get(badge.virtueId) : undefined;
  return name ? `${name}: ${milestone} stars!` : `${milestone} stars!`;
}

/**
 * "I can keep going..." becomes "You can keep going...", shown under "In this story you will learn". Only rewrites the
 * first person; the seed text is already written for children.
 */
export function youWillLearn(objective: string): string {
  const text = objective
    .trim()
    .replace(/\bI can\b/g, "you can")
    .replace(/\bI know\b/g, "you know")
    .replace(/\bmy\b/g, "your")
    .replace(/\bme\b/g, "you")
    .replace(/\bI\b/g, "you")
    .replace(/[.!]+$/, "");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** "The Tortoise and the Hare (Aesop's Fables)" becomes "A story from Aesop's Fables". */
export function sourceLine(sourceStory: string): string {
  const match = sourceStory.match(/\(([^)]+)\)\s*$/);
  if (!match) return "A story to enjoy";
  const collection = match[1].split("/")[0].trim();
  if (/folk tale$/i.test(collection)) return `${/^[aeiou]/i.test(collection) ? "An" : "A"} ${collection}`;
  return `A story from ${collection}`;
}
