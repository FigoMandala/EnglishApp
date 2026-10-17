"use client";

import {
  BookOpen,
  Dumbbell,
  GraduationCap,
  Layers,
  LogOut,
  Menu,
  MessageCircle,
  PenLine,
  ShieldCheck,
  SpellCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type NavLink = { href: string; label: string; icon: typeof GraduationCap; short?: string };

type NavGroup = { title: string | null; items: NavLink[]; adminOnly?: boolean };

const GROUPS: NavGroup[] = [
  {
    title: "Belajar",
    items: [
      { href: "/belajar", label: "Jalur Belajar", short: "Jalur", icon: Layers },
      { href: "/kosakata", label: "Kosakata", short: "Kosa", icon: SpellCheck },
      { href: "/materi", label: "Materi Grammar", short: "Materi", icon: BookOpen },
      { href: "/latihan", label: "Latihan Bebas", short: "Latihan", icon: Dumbbell },
      { href: "/writing", label: "Writing Coach", short: "Nulis", icon: PenLine },
      { href: "/tutor", label: "Tutor AI", short: "Tutor", icon: MessageCircle },
    ],
  },
  {
    title: "Tes",
    items: [{ href: "/eptr", label: "EPrT", short: "EPrT", icon: GraduationCap }],
  },
];

/** Tujuan utama di tab bar bawah (mobile). Sisanya lewat tombol Menu. */
const TAB_HREFS = ["/belajar", "/kosakata", "/eptr"];

/**
 * Mode fokus: saat mengerjakan soal atau mengulang kartu, tab bar bawah disembunyikan
 * supaya layar HP penuh untuk soal. Menu tetap bisa dibuka dari header.
 */
function isFocusMode(pathname: string, params: URLSearchParams) {
  if (pathname === "/eptr" && params.has("s")) return true;
  if (pathname === "/eptr/simulasi" && params.has("p")) return true;
  if (pathname === "/kosakata" && params.has("review")) return true;
  return false;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  username,
  isAdmin,
  logoutAction,
}: {
  children: ReactNode;
  username: string;
  isAdmin: boolean;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focus = isFocusMode(pathname, new URLSearchParams(searchParams.toString()));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  const groups = GROUPS.filter((group) => isAdmin || !group.adminOnly);
  const allLinks = groups.flatMap((group) => group.items);
  const tabs = TAB_HREFS.map((href) => allLinks.find((link) => link.href === href)).filter(
    (link): link is NavLink => Boolean(link),
  );
  const tabActive = tabs.some((tab) => isActive(pathname, tab.href));

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const menuButton = menuRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      menuButton?.focus();
    };
  }, [drawerOpen]);

  const initials = username.slice(0, 2).toUpperCase();

  const navList = () =>
    groups.map((group, index) => (
      <div key={group.title ?? index} className={cn(index > 0 && "mt-5")}>
        {group.title ? (
          <p className="px-3 pb-1.5 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-ink-faint">
            {group.title}
          </p>
        ) : null}
        <div className="flex flex-col gap-0.5">
          {group.items.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-[0.9375rem] font-semibold transition-colors",
                  active
                    ? "bg-primary-soft font-bold text-primary-deep"
                    : "text-ink-subtle hover:bg-surface-muted hover:text-ink",
                )}
              >
                {active ? (
                  <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary" />
                ) : null}
                <link.icon
                  className={cn("size-[1.125rem] shrink-0", active ? "text-primary" : "text-ink-faint group-hover:text-ink-subtle")}
                  aria-hidden
                />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    ));

  const userCard = (
    <div className="flex flex-col gap-2">
      {isAdmin ? (
        <Link
          href="/admin"
          className="ledge flex min-h-11 items-center gap-2.5 rounded-control bg-charcoal px-3 text-[0.875rem] font-bold text-white [--ledge:#000]"
        >
          <ShieldCheck className="size-4 text-mango" aria-hidden />
          Mode Admin
        </Link>
      ) : null}
      <div className="flex items-center gap-2.5 rounded-control px-2 py-1.5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-deep text-[0.8125rem] font-extrabold text-white"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.875rem] font-bold text-ink">@{username}</span>
          <span className="block text-[0.75rem] font-semibold text-ink-faint">{isAdmin ? "Admin" : "Murid"}</span>
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Keluar"
            title="Keluar"
            className="flex size-10 cursor-pointer items-center justify-center rounded-control border-2 border-hairline bg-surface text-ink-subtle transition-colors hover:border-negative hover:text-negative"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <Link href="/belajar" className="flex items-center gap-2.5 font-display text-lg font-extrabold text-ink">
      <span className="flex size-9 items-center justify-center rounded-[12px] bg-primary-deep font-extrabold text-white shadow-card">
        E
      </span>
      EnglishApp
    </Link>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#konten"
        className="sr-only z-50 rounded-control bg-ink px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Lewati ke konten
      </a>

      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r-2 border-hairline bg-surface lg:flex">
        <div className="flex h-16 items-center border-b-2 border-hairline px-4">{brand}</div>
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigasi utama">
          {navList()}
        </nav>
        <div className="border-t-2 border-hairline px-3 py-3">{userCard}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <header className="sticky top-0 z-30 border-b-2 border-hairline bg-canvas/90 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            {brand}
            <button
              ref={menuRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="menu-navigasi"
              aria-label="Buka menu"
              className="ml-auto flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control border-2 border-hairline bg-surface text-ink-subtle transition-colors hover:border-primary hover:text-primary"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </header>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/45" onClick={() => setDrawerOpen(false)} aria-hidden />
            <div
              id="menu-navigasi"
              role="dialog"
              aria-modal="true"
              aria-label="Menu navigasi"
              className="page-enter absolute inset-y-0 right-0 flex w-[min(20rem,86vw)] flex-col border-l-2 border-hairline bg-surface shadow-overlay"
            >
              <div className="flex h-14 items-center justify-between border-b-2 border-hairline px-4">
                <span className="font-display text-lg font-extrabold text-ink">Menu</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Tutup menu"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-control text-ink-subtle hover:bg-surface-muted hover:text-ink"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigasi">
                {navList()}
              </nav>
              <div className="border-t-2 border-hairline px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {userCard}
              </div>
            </div>
          </div>
        ) : null}

        <main
          id="konten"
          className={cn("flex-1 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10", focus ? "pb-10" : "pb-28")}
        >
          <div key={pathname} className="page-enter mx-auto max-w-6xl">
            {children}
          </div>
        </main>

        {/* Tab bar mobile (disembunyikan di mode fokus) */}
        <nav
          hidden={focus}
          aria-label="Navigasi cepat"
          className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-2">
            {tabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold transition-colors",
                    active ? "text-primary-deep" : "text-ink-subtle hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active && "bg-primary-soft",
                    )}
                  >
                    <tab.icon className={cn("size-5", active && "text-primary")} aria-hidden />
                  </span>
                  {tab.short ?? tab.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="menu-navigasi"
              className={cn(
                "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold transition-colors",
                !tabActive ? "text-primary-deep" : "text-ink-subtle hover:text-ink",
              )}
            >
              <span
                className={cn("flex h-7 w-12 items-center justify-center rounded-full", !tabActive && "bg-primary-soft")}
              >
                <Menu className={cn("size-5", !tabActive && "text-primary")} aria-hidden />
              </span>
              Lainnya
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
