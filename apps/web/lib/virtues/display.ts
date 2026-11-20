// How each virtue LOOKS to a child: icon, colour and two short child-friendly lines. The ONE place for this (the student
// pages and the Phase 6 parent preview both read it). Plain data, safe for server and browser; no database access.
//
// Colour is never the only signal: every place that uses a colour also shows the icon and the name. The hues come from the
// Okabe-Ito colour-blind-safe palette (plus a few extra mid-tones whose icons differ), and all of them are mid-lightness so
// a tinted background and a coloured icon both work in light and dark mode.
import {
  ClipboardCheckIcon,
  FlameIcon,
  HammerIcon,
  HeartHandshakeIcon,
  HourglassIcon,
  LinkIcon,
  MountainIcon,
  ScaleIcon,
  SunIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

/** The fixed order of the ten virtues (matches `Virtue.position` 1..10). Never re-sort it by anything about the child. */
export const VIRTUE_SLUGS = [
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
] as const;
export type VirtueSlug = (typeof VIRTUE_SLUGS)[number];

export type VirtueDisplay = {
  slug: VirtueSlug;
  name: string;
  icon: LucideIcon;
  /** Hex accent. Used for tints, borders and icons, never as the only signal. */
  color: string;
  /** A few words for cards and chips. */
  line: string;
  /** One friendly sentence for the "10 virtues" list. */
  explain: string;
};

export const VIRTUE_DISPLAY: Record<VirtueSlug, VirtueDisplay> = {
  "self-discipline": {
    slug: "self-discipline",
    name: "Self-Discipline",
    icon: HourglassIcon,
    color: "#0072B2",
    line: "Stay calm and choose well",
    explain: "Taking a breath and choosing well, even when you really want something right now.",
  },
  compassion: {
    slug: "compassion",
    name: "Compassion",
    icon: HeartHandshakeIcon,
    color: "#CC79A7",
    line: "Care when someone is hurting",
    explain: "Noticing when someone feels sad or hurt, and helping them feel better.",
  },
  responsibility: {
    slug: "responsibility",
    name: "Responsibility",
    icon: ClipboardCheckIcon,
    color: "#E69F00",
    line: "Do your part and keep promises",
    explain: "Doing your job and keeping your promises, because other people count on you.",
  },
  friendship: {
    slug: "friendship",
    name: "Friendship",
    icon: UsersIcon,
    color: "#56B4E9",
    line: "Be a friend people can trust",
    explain: "Being kind, fair and there for your friends, in good times and tricky times.",
  },
  work: {
    slug: "work",
    name: "Work",
    icon: HammerIcon,
    color: "#009E73",
    line: "Be proud of honest effort",
    explain: "Doing your best, honestly, and feeling proud of the effort you put in.",
  },
  courage: {
    slug: "courage",
    name: "Courage",
    icon: FlameIcon,
    color: "#D55E00",
    line: "Do the right thing, even if it's scary",
    explain: "Standing up for what is right, even when your tummy feels wobbly.",
  },
  perseverance: {
    slug: "perseverance",
    name: "Perseverance",
    icon: MountainIcon,
    color: "#7B5EA7",
    line: "Keep going, one step at a time",
    explain: "Not giving up when things are hard or slow. Small steps still get you there.",
  },
  honesty: {
    slug: "honesty",
    name: "Honesty",
    icon: ScaleIcon,
    color: "#B09A00",
    line: "Tell the truth",
    explain: "Telling the truth and doing what you say, even when a fib would be easier.",
  },
  loyalty: {
    slug: "loyalty",
    name: "Loyalty",
    icon: LinkIcon,
    color: "#5C7C8A",
    line: "Stick with the people you love",
    explain: "Staying with your family and friends when things get hard.",
  },
  faith: {
    slug: "faith",
    name: "Faith",
    icon: SunIcon,
    color: "#A0643C",
    line: "Hope, thanks and wonder",
    explain: "Hoping, saying thank you, and feeling wonder for the world around you.",
  },
};

export const isVirtueSlug = (slug: string): slug is VirtueSlug => slug in VIRTUE_DISPLAY;

/** Display data for a slug, or a neutral fallback so an unknown virtue added later never crashes a page. */
export function virtueDisplay(slug: string, fallbackName = "Virtue"): VirtueDisplay {
  return isVirtueSlug(slug) ? VIRTUE_DISPLAY[slug] : { ...VIRTUE_DISPLAY.faith, slug: VIRTUE_DISPLAY.faith.slug, name: fallbackName, color: "#5C7C8A", line: "", explain: "" };
}

/** Inline style for a soft tint of the virtue colour that stays readable in light and dark mode (the text stays foreground). */
export function virtueTint(color: string, strength = 16): { backgroundColor: string; borderColor: string } {
  return {
    backgroundColor: `color-mix(in oklab, ${color} ${strength}%, var(--card))`,
    borderColor: `color-mix(in oklab, ${color} 55%, var(--card))`,
  };
}
