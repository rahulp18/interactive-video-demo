import {
  BarChart3Icon,
  CircleHelpIcon,
  ClipboardListIcon,
  CompassIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UploadIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/library", label: "Library", icon: CompassIcon },
  { href: "/upload", label: "Upload Video", icon: UploadIcon },
  { href: "/videos", label: "My Videos", icon: VideoIcon },
  { href: "/responses", label: "Responses", icon: BarChart3Icon },
  { href: "/surveys", label: "Surveys", icon: ClipboardListIcon },
  { href: "/quizzes", label: "Quizzes", icon: CircleHelpIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/** The video editor lives under /videos/[id] and keeps "My Videos" highlighted. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function titleFor(pathname: string): string {
  if (/^\/videos\/[^/]+/.test(pathname)) return "Video editor";
  if (/^\/responses\/[^/]+/.test(pathname)) return "Video responses";
  return NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ?? "Interactive Video";
}
