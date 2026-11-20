// Child-safe shapes for the student pages (Home, Journeys, Module, Virtue Tree, Profile). Plain data, safe for the browser.
// By construction there is NO score, percentage, confidence, trend, rank, weakness or threat field here, and no discussion
// prompts. Virtues are always listed in their fixed order (1..10), never sorted by how the child is doing.

export type ModuleStatus = "completed" | "in-progress" | "ready" | "locked";
export type TreeStage = "sapling" | "young" | "full";

export type ModuleCard = {
  moduleId: number;
  title: string;
  /** Virtue slugs, primary first (display data comes from lib/virtues/display.ts). */
  virtues: string[];
  status: ModuleStatus;
  /** 0..1 of the video watched, only for "in-progress". About the video, not about the child. */
  watchedFraction: number | null;
};

export type JourneyLevel = {
  level: number;
  /** False while an earlier level still has unfinished stories. */
  open: boolean;
  modules: ModuleCard[];
};

export type JourneyCard = {
  journeyId: number;
  title: string;
  description: string;
  focusVirtue: string | null;
  levels: JourneyLevel[];
  storiesDone: number;
  storiesTotal: number;
};

export type StudentSummary = { name: string; username: string | null; avatar: string | null };

export type RewardBadge = { id: string; title: string };

/** Home: everything in one loader. `continue` wins over `upNext`; at most one of them is set. */
export type StudentOverview = {
  student: StudentSummary;
  journeys: JourneyCard[];
  continue: { moduleId: number; title: string; virtues: string[]; watchedFraction: number } | null;
  upNext: { moduleId: number; title: string; virtues: string[] } | null;
  storiesFinished: number;
  totalStars: number;
  badgeCount: number;
  newestBadge: RewardBadge | null;
  treeStage: TreeStage;
  /** For the small tree preview: fixed virtue order. */
  branches: TreeBranch[];
};

export type JourneysData = { journeys: JourneyCard[] };

export type ModulePageData =
  | {
      status: "ok";
      moduleId: number;
      title: string;
      /** "A story from Aesop's Fables" */
      sourceLine: string;
      virtues: string[];
      /** Child-voiced learning line, shown under "In this story you will learn...". */
      youWillLearn: string;
      moduleStatus: Exclude<ModuleStatus, "locked">;
      watchedFraction: number | null;
      /** Only once the story is completed. */
      followUpActivity: string | null;
      journey: { journeyId: number; title: string } | null;
    }
  | { status: "locked"; moduleId: number; title: string; virtues: string[]; unlockHint: string; journey: { journeyId: number; title: string } | null }
  | { status: "missing" };

export type TreeBranch = {
  slug: string;
  name: string;
  /** Whole stars from positive answers. Drives the leaves; never shown as a number or compared between virtues. */
  stars: number;
};

export type NextBadge = { id: string; title: string };

export type VirtueTreeData = {
  stage: TreeStage;
  totalStars: number;
  /** Fixed virtue order. */
  branches: TreeBranch[];
  superpowers: { slug: string; name: string }[];
  badges: RewardBadge[];
  nextBadges: NextBadge[];
};

export type ProfileData = StudentSummary & { storiesFinished: number; totalStars: number; badgeCount: number };
