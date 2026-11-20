import { ANT_AND_THE_GRASSHOPPER, BRAVE_LITTLE_PARROT, DOG_AND_THE_REFLECTION, TORTOISE_AND_THE_HARE } from "./perseverance-path";
import { BOY_WHO_CRIED_WOLF, HONEST_WOODCUTTER, PIGEONS_AND_THE_NET } from "./honesty-trail";
import { DOVE_AND_THE_ANT, INJURED_SWAN, LITTLE_MANGO_SEED } from "./kindness-and-friends";
import type { ModuleDef, VirtueSlug } from "./types";

export { CLIPS } from "./clips";
export { JOURNEYS } from "./journeys";
export * from "./types";

/** The 10 demo modules. Each core virtue is the primary virtue of exactly one module. */
export const MODULES: ModuleDef[] = [
  TORTOISE_AND_THE_HARE, // perseverance
  ANT_AND_THE_GRASSHOPPER, // work
  BRAVE_LITTLE_PARROT, // courage
  DOG_AND_THE_REFLECTION, // self-discipline
  HONEST_WOODCUTTER, // honesty
  BOY_WHO_CRIED_WOLF, // responsibility
  PIGEONS_AND_THE_NET, // loyalty
  INJURED_SWAN, // compassion
  DOVE_AND_THE_ANT, // friendship
  LITTLE_MANGO_SEED, // faith
];

export const MODULE_BY_SLUG = new Map(MODULES.map((m) => [m.slug, m]));

/** The 10 core virtues in their fixed order (matches the migration's seed). */
export const VIRTUE_SLUGS: VirtueSlug[] = [
  "self-discipline",
  "compassion",
  "responsibility",
  "friendship",
  "work",
  "courage",
  "perseverance",
  "honesty",
  "loyalty",
  "faith",
];

export const DEMO_FILE_KEY_PREFIX = "demo:";
export const demoFileKey = (slug: string) => `${DEMO_FILE_KEY_PREFIX}${slug}`;
