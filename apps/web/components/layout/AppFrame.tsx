"use client";

import { MenuIcon, PlayCircleIcon, PlusIcon, ShieldCheckIcon, XIcon } from "lucide-react";
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

function BrandMark({ role, rail = false }: { role: UserRole; rail?: boolean }) {
  return (
    <Link
      href={role === "STUDENT" ? "/student" : homePathFor(role)}
      aria-label="PARICHAY home"
      className={cn(
        "flex items-center gap-2 rounded-md px-2 text-base font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        role === "STUDENT" && "min-h-12",
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <PlayCircleIcon className="size-4" aria-hidden />
      </span>
      <span className={cn(rail && "max-lg:sr-only")}>PARICHAY</span>
    </Link>
  );
}

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

function Avatar({ name, avatar }: { name: string; avatar?: string | null }) {
  if (avatar) return <AvatarBubble avatar={avatar} name={name} className="size-9 text-lg" />;
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {initialOf(name)}
    </span>
  );
}

/**
 * `rail`: below `lg` render icon-only (the md–lg tablet rail); labels stay available to screen readers and as tooltips.
 * The mobile drawer never uses it.
 */
function SidebarContent({ user, rail }: { user: User; rail: boolean }) {
  const pathname = usePathname();
  const groups = navGroupsFor(user.role);
  const profileActive = user.role === "STUDENT" && pathname.startsWith("/student/profile");
  return (
    <div className={cn("flex h-full flex-col gap-6 p-4", rail && "max-lg:px-2")}>
      <BrandMark role={user.role} rail={rail} />
      <nav aria-label="Main" className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">
        {groups.map((group, index) => (
          <div key={group.label ?? index} role="group" aria-label={group.label} className="flex flex-col gap-1">
            {group.label && (
              <>
                <p className={cn("px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase", rail && "max-lg:hidden")}>
                  {group.label}
                </p>
                {rail && index > 0 && <hr aria-hidden className="mx-3 mb-1 border-sidebar-border lg:hidden" />}
              </>
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
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    user.role === "STUDENT" ? "min-h-12 rounded-2xl text-base" : "min-h-10 text-sm",
                    rail && "max-lg:justify-center max-lg:px-0",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  <span className={cn("truncate", rail && "max-lg:sr-only")}>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-sidebar-border pt-4">
        {user.role === "STUDENT" ? (
          <>
            <Link
              href={STUDENT_GROWNUPS_LINK.href}
              title={rail ? STUDENT_GROWNUPS_LINK.label : undefined}
              aria-current={pathname.startsWith(STUDENT_GROWNUPS_LINK.href) ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                rail && "max-lg:justify-center max-lg:px-0",
              )}
            >
              <ShieldCheckIcon className="size-[18px] shrink-0" aria-hidden />
              <span className={cn(rail && "max-lg:sr-only")}>{STUDENT_GROWNUPS_LINK.label}</span>
            </Link>
            <Link
              href="/student/profile"
              title={rail ? user.name : undefined}
              aria-current={profileActive ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl p-1.5 outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                rail && "max-lg:justify-center",
              )}
            >
              <Avatar name={user.name} avatar={user.avatar} />
              <span className={cn("min-w-0", rail && "max-lg:sr-only")}>
                <span className="block truncate text-sm font-medium">{user.name}</span>
              </span>
            </Link>
          </>
        ) : (
          <div className="flex items-center gap-3 px-1">
            <Avatar name={user.name} avatar={user.avatar} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}
        <LogoutButton rail={rail} className="flex-col items-stretch gap-2 [&>button]:w-full" buttonClassName={user.role === "STUDENT" ? "min-h-12 rounded-2xl" : undefined} />
      </div>
    </div>
  );
}

/** Persistent sidebar (md+; icon rail on tablet for students), slide-over navigation (mobile), top bar and the content workspace. */
/** Phone-only bottom tab bar for students: the four destinations, icon + short label, 48px+ targets, safe-area padding. */
function StudentTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
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
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  active ? "font-bold text-sidebar-accent-foreground" : "font-medium text-muted-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-sidebar-accent")}
                >
                  <Icon className="size-5" />
                </span>
                <span aria-hidden className="max-w-full truncate">
                  {item.shortLabel ?? item.label}
                </span>
                {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
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
    <div className={cn("flex min-h-dvh flex-1", isStudent && fontClass)} data-audience={isStudent ? "student" : undefined}>
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 print:hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block",
          isStudent ? "w-16 lg:w-64" : "w-64",
        )}
      >
        <SidebarContent user={user} rail={isStudent} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground shadow-xl">
            <button
              type="button"
              autoFocus
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
            <SidebarContent user={user} rail={false} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={cn("sticky top-0 z-30 flex items-center gap-3 print:hidden border-b bg-background/90 px-4 backdrop-blur sm:px-6", isStudent ? "h-16" : "h-14")}>
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
            className={cn("min-w-0 flex-1 truncate text-base font-semibold tracking-tight", isStudent && "max-sm:sr-only")}
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
            <Link href="/upload" className={buttonVariants({ size: "sm" })}>
              <PlusIcon aria-hidden /> Upload<span className="hidden sm:inline"> video</span>
            </Link>
          )}
        </header>
        <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8", isStudent && "pb-28 md:pb-8")}>{children}</main>
        {isStudent && <StudentTabBar />}
      </div>
    </div>
  );
}
