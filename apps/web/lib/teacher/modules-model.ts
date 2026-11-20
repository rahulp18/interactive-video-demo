// Story-module details as a teacher edits them. Shared by the server action and the browser form, so nothing here may
// import server-only code. The database still enforces the hard rules (secondary != primary, at most 2 secondaries).

export const AGE_BANDS = ["8-9", "10-12"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const isAgeBand = (v: unknown): v is AgeBand => v === "8-9" || v === "10-12";

export const MODULE_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const SOURCE_STORY_MAX = 200;
export const OBJECTIVE_MAX = 300;
export const PROMPT_MAX = 300;
export const PROMPTS_MAX = 5;
export const ACTIVITY_MAX = 600;
export const SECONDARY_MAX = 2;

export type ModuleDetailsInput = {
  sourceStory: string;
  primaryVirtueId: number;
  secondaryVirtueIds: number[];
  ageBand: AgeBand;
  learningObjective: string;
  discussionPrompts: string[];
  followUpActivity: string;
};

export type ModuleValidation = { value: ModuleDetailsInput; errors?: undefined } | { value?: undefined; errors: Record<string, string> };

const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/[ \t]+/g, " ") : "");
const isId = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 2_147_483_647;

/**
 * Validates module details. `virtueIds` is the set of real virtue ids (the 10 reference rows), so an unknown id is a
 * field error rather than a database error. Only named fields are copied out.
 */
export function validateModuleDetails(body: unknown, virtueIds: ReadonlySet<number>): ModuleValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { errors: { _: "Invalid request." } };
  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const sourceStory = clean(raw.sourceStory);
  if (!sourceStory) errors.sourceStory = "Name the story this module is based on.";
  else if (sourceStory.length > SOURCE_STORY_MAX) errors.sourceStory = `At most ${SOURCE_STORY_MAX} characters.`;

  const primaryVirtueId = raw.primaryVirtueId;
  if (!isId(primaryVirtueId) || !virtueIds.has(primaryVirtueId)) errors.primaryVirtueId = "Choose the main virtue.";

  const secondaryRaw = Array.isArray(raw.secondaryVirtueIds) ? raw.secondaryVirtueIds : [];
  const secondaryVirtueIds: number[] = [];
  for (const id of secondaryRaw) {
    if (!isId(id) || !virtueIds.has(id)) errors.secondaryVirtueIds = "Unknown virtue.";
    else if (!secondaryVirtueIds.includes(id)) secondaryVirtueIds.push(id);
  }
  if (!errors.secondaryVirtueIds) {
    if (secondaryVirtueIds.length > SECONDARY_MAX) errors.secondaryVirtueIds = `Pick at most ${SECONDARY_MAX} supporting virtues.`;
    else if (isId(primaryVirtueId) && secondaryVirtueIds.includes(primaryVirtueId)) errors.secondaryVirtueIds = "A supporting virtue cannot also be the main virtue.";
  }

  const ageBand = raw.ageBand;
  if (!isAgeBand(ageBand)) errors.ageBand = "Choose an age band.";

  const learningObjective = clean(raw.learningObjective);
  if (!learningObjective) errors.learningObjective = "Write what the child will learn.";
  else if (learningObjective.length > OBJECTIVE_MAX) errors.learningObjective = `At most ${OBJECTIVE_MAX} characters.`;

  const promptsRaw = Array.isArray(raw.discussionPrompts) ? raw.discussionPrompts : [];
  const discussionPrompts = promptsRaw.map(clean).filter(Boolean);
  if (discussionPrompts.length > PROMPTS_MAX) errors.discussionPrompts = `At most ${PROMPTS_MAX} prompts.`;
  else if (discussionPrompts.some((p) => p.length > PROMPT_MAX)) errors.discussionPrompts = `Each prompt can be at most ${PROMPT_MAX} characters.`;

  const followUpActivity = clean(raw.followUpActivity);
  if (!followUpActivity) errors.followUpActivity = "Suggest an activity for after the story.";
  else if (followUpActivity.length > ACTIVITY_MAX) errors.followUpActivity = `At most ${ACTIVITY_MAX} characters.`;

  if (Object.keys(errors).length > 0) return { errors };
  return {
    value: {
      sourceStory,
      primaryVirtueId: primaryVirtueId as number,
      secondaryVirtueIds,
      ageBand: ageBand as AgeBand,
      learningObjective,
      discussionPrompts,
      followUpActivity,
    },
  };
}

/** What a module needs before children may see it. `required` items block publishing; the others are advice. */
export type ReadinessItem = { key: string; label: string; ok: boolean; required: boolean; hint: string };

export type ReadinessFacts = {
  questionCount: number;
  textQuestionCount: number;
  weightedQuestionCount: number;
  promptCount: number;
  inJourney: boolean;
};

export function moduleReadiness(f: ReadinessFacts): ReadinessItem[] {
  return [
    {
      key: "questions",
      label: "Has questions on the timeline",
      ok: f.questionCount > 0,
      required: true,
      hint: "Add at least one question in the video editor.",
    },
    {
      key: "choice",
      label: "Every question is multiple choice",
      ok: f.textQuestionCount === 0,
      required: true,
      hint: "The children's player shows answer cards only. Change typed-answer questions to multiple choice.",
    },
    {
      key: "weights",
      label: "Answers are tagged with virtue weights",
      ok: f.weightedQuestionCount > 0,
      required: true,
      hint: "Without weights the story cannot grow any virtue. Tag options in the video editor.",
    },
    {
      key: "all-weighted",
      label: "Every question carries a weight",
      ok: f.questionCount > 0 && f.weightedQuestionCount === f.questionCount,
      required: false,
      hint: "Questions without weights are asked but not scored.",
    },
    {
      key: "prompts",
      label: "Discussion prompts for grown-ups",
      ok: f.promptCount > 0,
      required: false,
      hint: "Parents and teachers see these in the report's next steps.",
    },
    {
      key: "journey",
      label: "Placed in a journey",
      ok: f.inJourney,
      required: false,
      hint: "Stories outside a journey are always open to children and appear on their own.",
    },
  ];
}

export const canPublish = (items: readonly ReadinessItem[]) => items.every((i) => !i.required || i.ok);
