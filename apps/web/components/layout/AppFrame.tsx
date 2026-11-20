"use client";

import { ChevronRightIcon, MenuIcon, PlayCircleIcon, PlusIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AvatarBubble } from "@/components/student/AvatarBubble";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { homePathFor, type UserRole } from "@/lib/auth/roles";
import { STUDENT_GROWNUPS_LINK, STUDENT_NAV_ITEMS, isItemActive, navGroupsFor, titleFor } from "./nav-items";

type User = { name: string; email: string; role: UserRole; avatar?: string | null };

function BrandMark({ role, rail = false, onDark = false }: { role: UserRole; rail?: boolean; onDark?: boolean }) {
  const teacher = role === "TEACHER";
  return (
    <Link
      href={homePathFor(role)}
      aria-label="PARICHAY home"
      className={cn(
        "flex min-h-12 items-center gap-2.5 rounded-xl px-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        rail && "max-lg:justify-center max-lg:px-0",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-sm",
          onDark ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-primary text-primary-foreground",
          !teacher && "-rotate-6",
        )}
      >
        <PlayCircleIcon className="size-5" aria-hidden />
      </span>
      <span className={cn("flex flex-col leading-tight", rail && "max-lg:sr-only")}>
        <span className="text-lg font-extrabold tracking-tight">PARICHAY</span>
        <span className={cn("text-[11px] font-bold tracking-wider uppercase", onDark ? "text-sidebar-foreground/60" : "text-muted-foreground")}>
          {teacher ? "Teacher studio" : "Grow your virtues"}
        </span>
      </span>
    </Link>
  );
}

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || "?";
const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Teacher "studio" sidebar: a dark panel with the main action on top, grouped sections, a filled pill for the current
 * page and a compact profile card. `rail`: icon-only below `lg` (tablet); labels stay for screen readers and tooltips.
 */
function TeacherSidebar({ user, rail }: { user: User; rail: boolean }) {
  const pathname = usePathname();
  return (
    <div className={cn("flex h-full flex-col gap-5 px-3 py-4 lg:px-4", rail && "max-lg:px-2")}>
      <BrandMark role={user.role} rail={rail} onDark />
      <Link
        href="/upload"
        title={rail ? "Upload story video" : undefined}
        className={cn(
          "flex h-11 items-center justify-center gap-2 rounded-xl bg-sidebar-primary px-3 text-sm font-extrabold text-sidebar-primary-foreground shadow-sm outline-none transition-[filter] hover:brightness-105 focus-visible:ring-3 focus-visible:ring-sidebar-ring/60",
          rail && "max-lg:px-0",
        )}
      >
        <PlusIcon className="size-[18px] shrink-0" aria-hidden />
        <span className={cn(rail && "max-lg:sr-only")}>Upload story video</span>
      </Link>
      <nav aria-label="Main" className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">
        {navGroupsFor(user.role).map((group, index) => (
          <div key={group.label ?? index} role="group" aria-label={group.label} className="flex flex-col gap-1">
            {group.label && (
              <p className={cn("px-3 pb-1 text-[11px] font-bold tracking-[0.12em] text-sidebar-foreground/55 uppercase", rail && "max-lg:sr-only")}>
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const { href, label, icon: Icon } = item;
              const active = isItemActive(pathname, item);
              return (
                <Link
                  key={href}
                  href={href}
                  title={rail ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/60",
                    rail && "max-lg:justify-center max-lg:px-0",
                    active
                      ? "bg-sidebar-primary font-bold text-sidebar-primary-foreground shadow-sm"
                      : "font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  <span className={cn("truncate", rail && "max-lg:sr-only")}>{label}</span>
                  {active && <ChevronRightIcon className={cn("ml-auto size-4 shrink-0 opacity-70", rail && "max-lg:hidden")} aria-hidden />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={cn("flex items-center gap-2.5 rounded-2xl bg-sidebar-accent/70 p-2.5", rail && "max-lg:flex-col max-lg:p-1.5")}>
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sm font-extrabold text-sidebar-primary-foreground">
          {initialOf(user.name)}
        </span>
        <div className={cn("min-w-0 flex-1", rail && "max-lg:sr-only")}>
          <p className="truncate text-sm font-bold">{user.name}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{user.email}</p>
        </div>
        <LogoutButton
          iconOnly
          variant="ghost"
          buttonClassName="size-9 rounded-xl p-0 text-sidebar-foreground/75 hover:bg-sidebar hover:text-sidebar-foreground focus-visible:ring-sidebar-ring/60"
        />
      </div>
    </div>
  );
}

/**
 * Student sidebar: the same dark panel as the teacher studio, sized for children (48px+ rows, 20px icons). The current
 * page is a filled orange pill (plus bold text and aria-current, so colour is never the only signal). The grown-ups link
 * and the child's own card (avatar, name, sign out) sit at the bottom. `rail`: icons only below `lg`.
 */
/** A friendly colour per student menu item (icon chip), so each place feels different. */
const STUDENT_NAV_TINT: Record<string, string> = {
  "/student": "bg-rose-500 text-white shadow-sm shadow-rose-500/30",
  "/student/journeys": "bg-sky-500 text-white shadow-sm shadow-sky-500/30",
  "/student/virtues": "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
  "/student/profile": "bg-violet-500 text-white shadow-sm shadow-violet-500/30",
};

function StudentSidebar({ user, rail }: { user: User; rail: boolean }) {
  const pathname = usePathname();
  const grownUps = pathname.startsWith(STUDENT_GROWNUPS_LINK.href);
  const row = "group flex min-h-12 items-center gap-3 rounded-2xl px-2 text-[0.95rem] outline-none transition-all focus-visible:ring-3 focus-visible:ring-sidebar-ring/60";
  return (
    <div className={cn("flex h-full flex-col gap-4 px-3 py-4 lg:px-4", rail && "max-lg:px-2")}>
      <BrandMark role={user.role} rail={rail} onDark />

      {/* Greeting card: who is learning today */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-3xl bg-gradient-to-br from-sidebar-primary/25 to-sidebar-accent p-3 ring-1 ring-sidebar-border",
          rail && "max-lg:justify-center max-lg:p-1.5",
        )}
      >
        <AvatarBubble avatar={user.avatar} name={user.name} className="size-11 text-2xl" />
        <div className={cn("min-w-0 flex-1", rail && "max-lg:sr-only")}>
          <p className="text-xs text-sidebar-foreground/65">Hi there 👋</p>
          <p className="truncate text-sm font-bold">{firstNameOf(user.name)}</p>
        </div>
      </div>

      <nav aria-label="Main" className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1">
        {STUDENT_NAV_ITEMS.map((item) => {
          const { href, label, icon: Icon } = item;
          const active = isItemActive(pathname, item);
          return (
            <Link
              key={href}
              href={href}
              title={rail ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                row,
                rail && "max-lg:justify-center max-lg:px-0",
                active
                  ? "bg-sidebar-foreground font-bold text-sidebar shadow-md"
                  : "font-semibold text-sidebar-foreground/85 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground" : (STUDENT_NAV_TINT[href] ?? "bg-sidebar-accent"),
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className={cn("truncate", rail && "max-lg:sr-only")}>{label}</span>
              {active && <span aria-hidden className={cn("ml-auto size-2 shrink-0 rounded-full bg-sidebar-primary", rail && "max-lg:hidden")} />}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border pt-3">
        <Link
          href={STUDENT_GROWNUPS_LINK.href}
          title={rail ? STUDENT_GROWNUPS_LINK.label : undefined}
          aria-current={grownUps ? "page" : undefined}
          className={cn(
            row,
            "min-h-11 text-sm",
            rail && "max-lg:justify-center max-lg:px-0",
            grownUps ? "bg-sidebar-accent font-bold text-sidebar-foreground" : "font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center">
            <ShieldCheckIcon className="size-[18px]" />
          </span>
          <span className={cn(rail && "max-lg:sr-only")}>{STUDENT_GROWNUPS_LINK.label}</span>
        </Link>
        <div className={cn("flex items-center gap-2", rail && "max-lg:justify-center")}>
          <LogoutButton
            rail={rail}
            keepIcon
            variant="ghost"
            buttonClassName="h-11 w-full justify-start gap-3 rounded-2xl px-2 text-sm font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-ring/60"
          />
        </div>
      </div>
    </div>
  );
}

function SidebarContent({ user, rail }: { user: User; rail: boolean }) {
  return user.role === "STUDENT" ? <StudentSidebar user={user} rail={rail} /> : <TeacherSidebar user={user} rail={rail} />;
}

/** Phone-only bottom tab bar for students: dark like the sidebar, the current tab a filled orange pill, 64px targets. */
function StudentTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground shadow-[0_-4px_16px_rgb(0_0_0/0.12)] md:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {STUDENT_NAV_ITEMS.map((item) => {
          const active = isItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-1.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/60 focus-visible:ring-inset",
                  active ? "font-bold text-sidebar-foreground" : "font-semibold text-sidebar-foreground/65",
                )}
              >
                <span
                  aria-hidden
                  className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", active && "bg-sidebar-primary text-sidebar-primary-foreground")}
                >
                  <Icon className="size-5" />
                </span>
                <span aria-hidden className="max-w-full truncate">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppFrame({ user, fontClass, children }: { user: User; fontClass?: string; children: ReactNode }) {
  const pathname = usePathname();
  // The drawer is open only for the path it was opened on, so navigating closes it. Escape closes it too.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname && user.role !== "STUDENT"; // students use the bottom tab bar, not a drawer
  const setOpen = (value: boolean) => setOpenPath(value ? pathname : null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const isStudent = user.role === "STUDENT";
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenPath(null);
    document.addEventListener("keydown", onKey);
    // Lock page scroll behind the drawer; hand focus back to the menu button when it closes.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const button = menuButton.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      button?.focus();
    };
  }, [open]);

  return (
    <div className={cn("flex min-h-dvh flex-1", fontClass)} data-audience={isStudent ? "student" : "teacher"}>
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh w-[4.75rem] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block lg:w-68 print:hidden",
        )}
      >
        <SidebarContent user={user} rail />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-76 max-w-[85vw] bg-sidebar text-sidebar-foreground shadow-2xl">
            <button
              type="button"
              autoFocus
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 z-10 flex size-10 items-center justify-center rounded-xl text-sidebar-foreground/70 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/60"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
            <SidebarContent user={user} rail={false} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={cn("sticky top-0 z-30 flex items-center gap-3 print:hidden border-b bg-background/85 px-4 backdrop-blur sm:px-6", "h-16")}>
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            ref={menuButton}
            onClick={() => setOpen(true)}
            className={cn(
              "-ml-1 flex size-10 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden",
              isStudent && "hidden",
            )}
          >
            <MenuIcon className="size-5" aria-hidden />
          </button>
          {isStudent && (
            <div className="md:hidden">
              <BrandMark role={user.role} />
            </div>
          )}
          <p
            className={cn("min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight", isStudent && "max-sm:sr-only")}
            data-testid="page-title"
          >
            {titleFor(pathname)}
          </p>
          {isStudent && (
            <div className="flex items-center gap-1 md:hidden">
              <Link
                href={STUDENT_GROWNUPS_LINK.href}
                aria-label={STUDENT_GROWNUPS_LINK.label}
                data-touch
                className="flex size-12 items-center justify-center rounded-2xl text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ShieldCheckIcon className="size-5" aria-hidden />
              </Link>
              <LogoutButton rail buttonClassName="size-12 rounded-2xl p-0" />
            </div>
          )}
          {user.role === "TEACHER" && (
            <Link href="/upload" className={cn(buttonVariants({ size: "default" }), "h-10 rounded-xl px-4 text-sm font-bold shadow-sm md:hidden")}>
              <PlusIcon aria-hidden /> Upload
            </Link>
          )}
        </header>
        <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8", isStudent && "pb-28 md:pb-8")}>{children}</main>
        {isStudent && <StudentTabBar />}
      </div>
    </div>
  );
}
