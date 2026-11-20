import type { JourneyDef } from "./types";

// Every module appears in exactly one journey. Levels unlock in sequence (Phase 5 app logic).
export const JOURNEYS: JourneyDef[] = [
  {
    title: "Perseverance Path",
    description: "Stories about trying again, working hard and facing hard things bravely.",
    focus: "perseverance",
    displayOrder: 1,
    levels: [
      ["tortoise-and-the-hare", "ant-and-the-grasshopper"],
      ["brave-little-parrot", "dog-and-the-reflection"],
    ],
  },
  {
    title: "Honesty Trail",
    description: "Stories about telling the truth, keeping promises and standing together.",
    focus: "honesty",
    displayOrder: 2,
    levels: [["honest-woodcutter", "boy-who-cried-wolf"], ["pigeons-and-the-net"]],
  },
  {
    title: "Kindness & Friends",
    description: "Stories about caring for others, good friends and hope.",
    focus: "compassion",
    displayOrder: 3,
    levels: [["injured-swan", "dove-and-the-ant"], ["little-mango-seed"]],
  },
];
