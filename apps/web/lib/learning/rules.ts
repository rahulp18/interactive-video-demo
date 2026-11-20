// Pure rules of the student player: no I/O, importable by server and browser.

export type JourneyPlacement = { journeyId: number; moduleId: number; level: number; position: number };

/**
 * Which modules this student may open.
 * - The first level of a journey is always open.
 * - A later level opens once every module of the level before it (in that journey) is completed.
 * - A module placed in several journeys is open if it is open in ANY of them.
 * - A module that is in no journey at all stands alone and is open.
 */
export function unlockedModuleIds(placements: readonly JourneyPlacement[], completed: ReadonlySet<number>): Set<number> {
  const byJourney = new Map<number, JourneyPlacement[]>();
  for (const p of placements) byJourney.set(p.journeyId, [...(byJourney.get(p.journeyId) ?? []), p]);

  const open = new Set<number>();
  for (const modules of byJourney.values()) {
    const levels = [...new Set(modules.map((m) => m.level))].sort((a, b) => a - b);
    levels.forEach((level, i) => {
      const previous = i === 0 ? [] : modules.filter((m) => m.level === levels[i - 1]);
      if (previous.every((m) => completed.has(m.moduleId))) for (const m of modules) if (m.level === level) open.add(m.moduleId);
    });
  }
  return open;
}

/** Whether `moduleId` is open. A module with no placement at all is open (it is not part of any path). */
export function isModuleUnlocked(moduleId: number, placements: readonly JourneyPlacement[], completed: ReadonlySet<number>): boolean {
  if (!placements.some((p) => p.moduleId === moduleId)) return true;
  return unlockedModuleIds(placements, completed).has(moduleId);
}

/**
 * The module that follows `moduleId` in the first journey (by the order given) where a later module in the same
 * journey is open and not yet completed. Null when there is none (the caller then sends the child back to the journey).
 */
export function nextModuleAfter(
  moduleId: number,
  placements: readonly JourneyPlacement[],
  completed: ReadonlySet<number>,
  journeyOrder: readonly number[],
): { journeyId: number; moduleId: number } | null {
  const open = unlockedModuleIds(placements, completed);
  for (const journeyId of journeyOrder) {
    const modules = placements.filter((p) => p.journeyId === journeyId).sort((a, b) => a.level - b.level || a.position - b.position);
    const here = modules.findIndex((m) => m.moduleId === moduleId);
    if (here === -1) continue;
    const next = modules.slice(here + 1).find((m) => open.has(m.moduleId) && !completed.has(m.moduleId));
    if (next) return { journeyId, moduleId: next.moduleId };
  }
  return null;
}

export type ResumeInteraction = { id: number; timestamp: number; isSkippable: boolean };

/**
 * Where playback starts. Normally where the child stopped. If a required question that is still unanswered sits at or
 * before that point, start AT that question instead, so it cannot be bypassed. A finished (or fully watched) module
 * starts from the beginning.
 */
export function resumePosition(
  lastPositionSeconds: number,
  duration: number,
  interactions: readonly ResumeInteraction[],
  answeredIds: ReadonlySet<number>,
  completed: boolean,
): number {
  if (completed || !(lastPositionSeconds > 0) || (duration > 0 && lastPositionSeconds >= duration - 1)) return 0;
  const blocking = interactions
    .filter((i) => !i.isSkippable && !answeredIds.has(i.id) && i.timestamp <= lastPositionSeconds)
    .sort((a, b) => a.timestamp - b.timestamp)[0];
  return blocking ? blocking.timestamp : lastPositionSeconds;
}

/** Where "Watch again" starts for a question: the previous distinct question's timestamp, or 0 for the first. */
export function replayStart(timestamp: number, interactions: readonly { timestamp: number }[]): number {
  return interactions.reduce((best, i) => (i.timestamp < timestamp && i.timestamp > best ? i.timestamp : best), 0);
}
