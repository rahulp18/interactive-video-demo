"use client";

import { MenuIcon, PlayCircleIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS, titleFor } from "./nav-items";

type User = { name: string; email: string };

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-2 text-base font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <PlayCircleIcon className="size-4" aria-hidden />
      </span>
      Interactive Video
    </Link>
  );
}

function SidebarContent({ user }: { user: User }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand />
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-sidebar-border pt-4">
        <div className="flex items-center gap-3 px-1">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {user.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <LogoutButton className="flex-col items-stretch gap-2 [&>button]:w-full" />
      </div>
    </div>
  );
}

/** Persistent sidebar (md+), slide-over navigation (mobile), top bar and the content workspace. */
export function AppFrame({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname();
  // The drawer is open only for the path it was opened on, so navigating closes it. Escape closes it too.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (value: boolean) => setOpenPath(value ? pathname : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenPath(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
        <SidebarContent user={user} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground shadow-xl">
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
            <SidebarContent user={user} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="-ml-1 rounded-md p-2 hover:bg-muted md:hidden"
          >
            <MenuIcon className="size-5" aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight" data-testid="page-title">
            {titleFor(pathname)}
          </p>
          <Link href="/upload" className={buttonVariants({ size: "sm" })}>
            <PlusIcon aria-hidden /> Upload<span className="hidden sm:inline"> video</span>
          </Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
