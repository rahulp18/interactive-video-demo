import {
  BarChart3Icon,
  CircleHelpIcon,
  ClipboardListIcon,
  CompassIcon,
  HouseIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SproutIcon,
  UploadIcon,
  UserRoundIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/lib/auth/roles";

/** `alsoActive`: extra path prefixes that keep this item highlighted (e.g. the Library belongs to Explore Journeys). */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  alsoActive?: readonly string[];
  /** Shorter label for the phone tab bar, where four tabs share 360px. */
  shortLabel?: string;
};
export type NavGroup = { label?: string; items: NavItem[] };

export const TEACHER_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/library", label: "Library", icon: CompassIcon },
  { href: "/upload", label: "Upload Video", icon: UploadIcon },
  { href: "/videos", label: "My Videos", icon: VideoIcon },
  { href: "/responses", label: "Responses", icon: BarChart3Icon },
  { href: "/surveys", label: "Surveys", icon: ClipboardListIcon },
  { href: "/quizzes", label: "Quizzes", icon: CircleHelpIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/** Student navigation: exactly four destinations, in display order. Access is enforced by the route guards (see roles.ts). */
export const STUDENT_NAV_ITEMS: NavItem[] = [
  { href: "/student", label: "Home", icon: HouseIcon },
  { href: "/student/journeys", label: "Journeys", icon: CompassIcon, alsoActive: ["/student/modules"] },
  { href: "/student/virtues", label: "My Virtue Tree", shortLabel: "My Tree", icon: SproutIcon },
  { href: "/student/profile", label: "Profile", icon: UserRoundIcon },
];

/** Low-key link for adults, shown apart from the child's menu (never a tab). Placeholder until Phase 6. */
export const STUDENT_GROWNUPS_LINK = { href: "/student/parent", label: "For grown-ups", icon: ShieldCheckIcon } satisfies NavItem;

export const navGroupsFor = (role: UserRole): NavGroup[] =>
  role === "TEACHER" ? [{ items: TEACHER_NAV_ITEMS }] : [{ items: STUDENT_NAV_ITEMS }];

/** The video editor lives under /videos/[id] and keeps "My Videos" highlighted. */
const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** The student Home (`/student`) is a prefix of every other student route, so it only matches exactly. */
export function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/student") return pathname === item.href;
  return under(pathname, item.href) || (item.alsoActive?.some((prefix) => under(pathname, prefix)) ?? false);
}

export const isActive = (pathname: string, href: string) => under(pathname, href);

export function titleFor(pathname: string): string {
  if (/^\/videos\/[^/]+/.test(pathname)) return "Video editor";
  if (/^\/responses\/[^/]+/.test(pathname)) return "Video responses";
  const all = [...TEACHER_NAV_ITEMS, ...STUDENT_NAV_ITEMS, STUDENT_GROWNUPS_LINK];
  // Longest href first so "/student/journeys" wins over "/student".
  const match = all.filter((item) => isItemActive(pathname, item)).sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "PARICHAY";
}
