import {
  AwardIcon,
  BarChart3Icon,
  BookOpenIcon,
  ChartLineIcon,
  CircleHelpIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CompassIcon,
  FileTextIcon,
  GemIcon,
  HouseIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UploadIcon,
  UserRoundIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/lib/auth/roles";

/** `alsoActive`: extra path prefixes that keep this item highlighted (e.g. the Library belongs to Explore Journeys). */
export type NavItem = { href: string; label: string; icon: LucideIcon; alsoActive?: readonly string[] };
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

/** Student navigation, in display order. UI organisation only; access is enforced by the route guards (see roles.ts). */
export const STUDENT_NAV_GROUPS: NavGroup[] = [
  {
    label: "Learning",
    items: [
      { href: "/student", label: "Home", icon: HouseIcon },
      { href: "/student/journeys", label: "Explore Journeys", icon: CompassIcon, alsoActive: ["/library"] },
      { href: "/student/learning", label: "My Learning", icon: BookOpenIcon },
      { href: "/student/assignments", label: "My Assignments", icon: ClipboardCheckIcon },
    ],
  },
  {
    label: "My Development",
    items: [
      { href: "/student/progress", label: "My Progress", icon: ChartLineIcon },
      { href: "/student/virtues", label: "Virtue Profile", icon: GemIcon },
      { href: "/student/reports", label: "My Reports", icon: FileTextIcon },
    ],
  },
  { label: "Account", items: [{ href: "/student/profile", label: "My Profile", icon: UserRoundIcon }] },
];

export const STUDENT_NAV_ITEMS: NavItem[] = STUDENT_NAV_GROUPS.flatMap((group) => group.items);

export const navGroupsFor = (role: UserRole): NavGroup[] =>
  role === "TEACHER" ? [{ items: TEACHER_NAV_ITEMS }] : STUDENT_NAV_GROUPS;

// Student pages that predate the /student shell (still reachable, no longer in the sidebar).
const LEGACY_STUDENT_TITLES: NavItem[] = [
  { href: "/home", label: "Home", icon: HouseIcon },
  { href: "/results", label: "My Results", icon: AwardIcon },
];

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
  const all = [...TEACHER_NAV_ITEMS, ...STUDENT_NAV_ITEMS, ...LEGACY_STUDENT_TITLES];
  // Longest href first so "/student/journeys" wins over "/student".
  const match = all.filter((item) => isItemActive(pathname, item)).sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "PARICHAY";
}
