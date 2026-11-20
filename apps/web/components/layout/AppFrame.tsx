"use client";

import { MenuIcon, PlayCircleIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { homePathFor, type UserRole } from "@/lib/auth/roles";
import { isItemActive, navGroupsFor, titleFor } from "./nav-items";

type User = { name: string; email: string; role: UserRole };

function BrandMark({ role, rail = false }: { role: UserRole; rail?: boolean }) {
  return (
    <Link
      href={role === "STUDENT" ? "/student" : homePathFor(role)}
      aria-label="PARICHAY home"
      className="flex items-center gap-2 rounded-md px-2 text-base font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <PlayCircleIcon className="size-4" aria-hidden />
      </span>
      <span className={cn(rail && "max-lg:sr-only")}>PARICHAY</span>
    </Link>
  );
}

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

function Avatar({ name }: { name: string }) {
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
                    "relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
          <Link
            href="/student/profile"
            title={rail ? user.name : undefined}
            aria-current={profileActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg p-1.5 outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50",
              rail && "max-lg:justify-center",
            )}
          >
            <Avatar name={user.name} />
            <span className={cn("min-w-0", rail && "max-lg:sr-only")}>
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-3 px-1">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}
        <LogoutButton rail={rail} className="flex-col items-stretch gap-2 [&>button]:w-full" />
      </div>
    </div>
  );
}

/** Persistent sidebar (md+; icon rail on tablet for students), slide-over navigation (mobile), top bar and the content workspace. */
export function AppFrame({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname();
  // The drawer is open only for the path it was opened on, so navigating closes it. Escape closes it too.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
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
    <div className="flex min-h-dvh flex-1">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block",
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
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            ref={menuButton}
            onClick={() => setOpen(true)}
            className="-ml-1 flex size-10 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
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
          {user.role === "TEACHER" && (
            <Link href="/upload" className={buttonVariants({ size: "sm" })}>
              <PlusIcon aria-hidden /> Upload<span className="hidden sm:inline"> video</span>
            </Link>
          )}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
