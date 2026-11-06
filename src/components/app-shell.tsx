"use client";

import {
  ArrowRight,
  BookOpen,
  Dumbbell,
  Flame,
  GraduationCap,
  Layers,
  LogOut,
  Menu,
  MessageCircle,
  PenLine,
  ShieldCheck,
  SpellCheck,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { SoundToggle } from "@/components/fx/sound-toggle";
import { Logo } from "@/components/logo";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import type { ShellSummary } from "@/db/queries/shell";
import { buttonVariants } from "@/components/ui/button";

import { cn } from "@/lib/utils";

export type NavLink = { href: string; label: string; icon: typeof GraduationCap; short?: string };

type NavGroup = { title: string; items: NavLink[] };

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
    title: "Tes & motivasi",
    items: [
      { href: "/eptr", label: "EPrT", short: "EPrT", icon: GraduationCap },
      { href: "/liga", label: "Liga mingguan", short: "Liga", icon: Trophy },
      { href: "/streak", label: "Streak", short: "Streak", icon: Flame },
    ],
  },
];

/** Tujuan utama di tab bar bawah (mobile). Sisanya lewat tombol Lainnya. */
const TAB_HREFS = ["/belajar", "/latihan", "/kosakata", "/eptr"];

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

/** Mode latihan layar penuh (tanpa sidebar): header progres + footer aksi. */
const BARE_ROUTES = ["/latihan/dengar", "/latihan/ucapkan", "/latihan/pasangan", "/kosakata/review"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const nf = new Intl.NumberFormat("id-ID");

function NavBadge({ href, summary }: { href: string; summary: ShellSummary }) {
  if (href === "/kosakata" && summary.dueCards > 0) {
    return (
      <span
        aria-label={`${summary.dueCards} kartu jatuh tempo`}
        className="flex h-[22px] min-w-[26px] items-center justify-center rounded-full bg-mango px-[7px] text-[0.75rem] font-extrabold text-mango-on"
      >
        {summary.dueCards}
      </span>
    );
  }
  if (href === "/latihan" && summary.openMistakes > 0) {
    return (
      <span
        aria-label={`${summary.openMistakes} kesalahan belum ditebus`}
        className="flex h-[22px] min-w-[26px] items-center justify-center rounded-full border-2 border-brick-line bg-brick-soft px-1.5 text-[0.75rem] font-extrabold text-brick-deep"
      >
        {summary.openMistakes}
      </span>
    );
  }
  if (href === "/eptr" && summary.daysToTest !== null) {
    return (
      <span
        aria-label={`Tes EPrT ${summary.daysToTest} hari lagi`}
        className="flex h-[22px] items-center rounded-full bg-charcoal px-2 text-[0.75rem] font-extrabold text-mango-line"
      >
        H-{summary.daysToTest}
      </span>
    );
  }
  if (href === "/liga" && summary.leagueRank) {
    return <span className="text-[0.75rem] font-extrabold text-ink-subtle">#{summary.leagueRank}</span>;
  }
  return null;
}

export function AppShell({
  children,
  username,
  displayName,
  isAdmin,
  summary,
  logoutAction,
}: {
  children: ReactNode;
  username: string;
  displayName: string;
  isAdmin: boolean;
  summary: ShellSummary;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focus = isFocusMode(pathname, new URLSearchParams(searchParams.toString()));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);

  function openDrawer() {
    // Kalau drawer sedang dalam animasi keluar, batalkan supaya panel tidak
    // langsung ter-unmount oleh onAnimationEnd saat kembali dibuka.
    setDrawerClosing(false);
    setDrawerOpen(true);
  }

  const closeDrawer = useCallback(() => {
    if (!drawerOpen || drawerClosing) return;
    // Di bawah "kurangi gerakan" animasi exit dimatikan global, jadi
    // onAnimationEnd tidak akan menyala — tutup langsung tanpa state closing.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawerOpen(false);
      return;
    }
    setDrawerClosing(true);
  }, [drawerOpen, drawerClosing]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  // Effect yang memanggil closeDrawer sengaja hanya bergantung pada
  // [pathname]/[drawerOpen] — kalau closeDrawer ikut sebagai dependency,
  // perubahan state drawer memicu ulang effect "tutup saat pindah rute"
  // dan drawer langsung tertutup begitu dibuka. Ref menjaga closure tetap
  // segar tanpa mengubah identitas dependency.
  const closeDrawerRef = useRef(closeDrawer);
  useEffect(() => {
    closeDrawerRef.current = closeDrawer;
  });

  const allLinks = GROUPS.flatMap((group) => group.items);
  const tabs = TAB_HREFS.map((href) => allLinks.find((link) => link.href === href)).filter(
    (link): link is NavLink => Boolean(link),
  );
  const tabActive = tabs.some((tab) => isActive(pathname, tab.href));

  useEffect(() => {
    closeDrawerRef.current();
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const menuButton = menuRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawerRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      menuButton?.focus();
    };
  }, [drawerOpen]);

  // iOS Safari mengabaikan overflow:hidden; kunci scroll dengan position:fixed.
  useBodyScrollLock(drawerOpen);

  const initials = (displayName || username).slice(0, 2).toUpperCase();

  // Drill & mode ujian/soal EPrT: layar penuh tanpa sidebar (runner punya header sendiri).
  if (BARE_ROUTES.some((route) => pathname === route) || (focus && pathname.startsWith("/eptr"))) {
    return <div className="min-h-screen bg-canvas">{children}</div>;
  }

  const statStrip = (
    <div className="grid grid-cols-3 gap-1.5">
      <Link
        href="/streak"
        aria-label={`Streak ${summary.streak} hari`}
        className="flex h-10 items-center justify-center gap-1 rounded-[12px] border-2 border-mango-line bg-mango-soft font-round text-[1.0625rem] font-extrabold text-mango-ink"
      >
        <Flame className={cn("size-[18px] fill-mango text-mango-deep", summary.streak > 0 && "flick")} strokeWidth={2} aria-hidden />
        {summary.streak}
      </Link>
      <Link
        href="/progres"
        aria-label={`${nf.format(summary.xp)} XP total`}
        className="flex h-10 items-center justify-center gap-1 rounded-[12px] border-2 border-primary-line bg-primary-soft font-round text-[1.0625rem] font-extrabold text-primary-deep"
      >
        <Zap className="size-4 fill-primary-bright text-primary-deep" strokeWidth={2} aria-hidden />
        {nf.format(summary.xp)}
      </Link>
      <Link
        href="/liga"
        aria-label={`Level ${summary.level}`}
        className="flex h-10 items-center justify-center gap-1 rounded-[12px] border-2 border-sky-line bg-sky-soft font-round text-[1.0625rem] font-extrabold text-sky-deep"
      >
        <Trophy className="size-4" strokeWidth={2.4} aria-hidden />
        Lv {summary.level}
      </Link>
    </div>
  );

  const continueCard = summary.current ? (
    <div className="flex flex-col gap-2.5 rounded-[16px] border-2 border-hairline bg-surface p-3.5 shadow-[0_3px_0_var(--color-hairline)]">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-ink-subtle">Lanjutkan</span>
        {summary.current.total > 0 ? (
          <span className="text-[0.75rem] font-extrabold text-primary-deep">
            {summary.current.done}/{summary.current.total}
          </span>
        ) : null}
      </div>
      <strong className="font-display text-[0.9375rem] font-extrabold leading-tight">
        Unit {summary.current.order} · {summary.current.title}
      </strong>
      {summary.current.total > 0 ? (
        <div className="h-2 overflow-hidden rounded-full bg-canvas-deep">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${(summary.current.done / summary.current.total) * 100}%` }}
          />
        </div>
      ) : null}
      <Link
        href={`/belajar/${summary.current.slug}`}
        className={buttonVariants({ variant: "primary", size: "sm", className: "justify-center gap-1.5" })}
      >
        Lanjut belajar
        <ArrowRight className="size-4" strokeWidth={2.6} aria-hidden />
      </Link>
    </div>
  ) : null;

  const navList = () =>
    GROUPS.map((group, index) => (
      <div key={group.title} className={cn(index > 0 && "mt-[18px]")}>
        <p className="eyebrow px-3 pb-1.5 text-ink-faint">{group.title}</p>
        <div className="flex flex-col gap-0.5">
          {group.items.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-control border-2 px-3 text-[0.9375rem] transition-colors",
                  active
                    ? "border-primary-line bg-primary-soft font-extrabold text-primary-deep"
                    : "border-transparent font-bold text-ink-muted hover:bg-[#efe8da]",
                )}
              >
                <link.icon
                  className={cn("size-5 shrink-0", active ? "text-primary" : "text-ink-faint group-hover:text-ink-subtle")}
                  strokeWidth={2.2}
                  aria-hidden
                />
                <span className="flex-1">{link.label}</span>
                <NavBadge href={link.href} summary={summary} />
              </Link>
            );
          })}
        </div>
      </div>
    ));

  const avatar = (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mango font-display text-[0.875rem] font-black text-mango-on shadow-[inset_0_0_0_3px_#fff,0_0_0_2px_var(--color-mango-line)]"
    >
      {initials}
    </span>
  );

  const userCard = (
    <div className="flex flex-col gap-2">
      {isAdmin ? (
        <Link
          href="/admin"
          className="flex min-h-11 items-center gap-2.5 rounded-control bg-charcoal px-3 text-[0.875rem] font-bold text-white shadow-[0_4px_0_#000] transition-transform active:translate-y-1 active:shadow-none"
        >
          <ShieldCheck className="size-4 text-mango" aria-hidden />
          Mode Admin
        </Link>
      ) : null}
      <div className="flex items-center gap-2">
        <Link
          href="/progres"
          aria-label="Profil dan progres"
          aria-current={pathname === "/progres" ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-control border-2 p-1.5",
            pathname === "/progres" ? "border-primary-line bg-primary-soft" : "border-transparent hover:bg-surface",
          )}
        >
          {avatar}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[0.875rem] font-extrabold text-ink">{displayName || `@${username}`}</span>
            <span className="block truncate text-[0.75rem] font-bold text-ink-subtle">
              @{username} · {isAdmin ? "Admin" : "Pengguna"}
            </span>
          </span>
        </Link>
        <SoundToggle />
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Keluar"
            title="Keluar"
            className="flex size-10 cursor-pointer items-center justify-center rounded-[12px] border-2 border-hairline bg-surface text-ink-subtle transition-colors hover:border-brick-line hover:text-brick-deep"
          >
            <LogOut className="size-[18px]" aria-hidden />
          </button>
        </form>
      </div>
    </div>
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
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r-2 border-hairline bg-surface-muted lg:flex">
        <div className="flex h-[68px] shrink-0 items-center border-b-2 border-hairline px-[18px]">
          <Logo href="/belajar" size={36} />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-3.5 px-3.5 pt-3.5">
            {statStrip}
            {continueCard}
          </div>
          <nav className="flex-1 px-3 py-[18px]" aria-label="Navigasi utama">
            {navList()}
          </nav>
        </div>
        <div className="border-t-2 border-hairline p-3">{userCard}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <header className="sticky top-0 z-30 border-b-2 border-hairline bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
          <div className="flex h-[60px] items-center gap-2 px-4 sm:px-6">
            <Logo href="/belajar" size={34} showText={false} />
            <span className="flex-1" />
            <Link
              href="/streak"
              aria-label={`Streak ${summary.streak} hari`}
              className="flex h-10 items-center gap-1 rounded-[10px] bg-mango-soft px-2.5 font-round text-[1rem] font-extrabold text-mango-ink"
            >
              <Flame className="size-4 fill-mango text-mango-deep" strokeWidth={2} aria-hidden />
              {summary.streak}
            </Link>
            <Link
              href="/progres"
              aria-label={`${nf.format(summary.xp)} XP`}
              className="flex h-10 items-center gap-1 rounded-[10px] bg-primary-soft px-2.5 font-round text-[1rem] font-extrabold text-primary-deep"
            >
              <Zap className="size-3.5 fill-primary-bright text-primary-deep" strokeWidth={2} aria-hidden />
              {nf.format(summary.xp)}
            </Link>
            <button
              ref={menuRef}
              type="button"
              onClick={openDrawer}
              aria-expanded={drawerOpen}
              aria-controls="menu-navigasi"
              aria-label="Buka menu"
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[12px] text-ink-subtle hover:bg-surface"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </header>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className={cn("absolute inset-0 bg-ink/45", drawerClosing ? "drawer-fade-out" : "drawer-fade-in")}
              onClick={closeDrawer}
              aria-hidden
            />
            <div
              id="menu-navigasi"
              role="dialog"
              aria-modal="true"
              aria-label="Menu lainnya"
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget && e.animationName === "drawer-panel-out") {
                  setDrawerOpen(false);
                  setDrawerClosing(false);
                }
              }}
              className={cn(
                "absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col border-l-2 border-hairline bg-canvas shadow-overlay",
                drawerClosing ? "drawer-panel-out" : "drawer-panel-in",
              )}
            >
              <div className="flex h-[60px] items-center justify-between border-b-2 border-hairline px-4">
                <span className="font-display text-[1.375rem] font-black text-ink">Lainnya</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Tutup menu"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-control text-ink-subtle hover:bg-surface hover:text-ink"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
                <Link
                  href="/progres"
                  className="flex items-center gap-3 rounded-plate border-2 border-hairline bg-surface p-3.5 shadow-card"
                >
                  {avatar}
                  <span className="min-w-0 flex-1 leading-tight">
                    <strong className="block truncate text-[1rem]">{displayName || `@${username}`}</strong>
                    <span className="text-[0.8125rem] text-ink-subtle">
                      Level {summary.level} · {nf.format(summary.xp)} XP
                    </span>
                  </span>
                </Link>
                {statStrip}
                {continueCard}
                <nav aria-label="Navigasi" className="grid grid-cols-2 gap-2.5">
                  {allLinks.map((link) => {
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-[84px] flex-col justify-between gap-2 rounded-[18px] border-2 p-3.5",
                          active ? "border-primary-line bg-primary-soft text-primary-deep" : "border-hairline bg-surface",
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <link.icon className="size-[22px] text-primary" strokeWidth={2.2} aria-hidden />
                          <NavBadge href={link.href} summary={summary} />
                        </span>
                        <strong className="text-[0.9375rem] leading-tight">{link.label}</strong>
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <div className="border-t-2 border-hairline p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{userCard}</div>
            </div>
          </div>
        ) : null}

        <main
          id="konten"
          className={cn("flex-1 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10", focus ? "pb-10" : "pb-28")}
        >
          <div className="mx-auto max-w-[1120px]">
            {children}
          </div>
        </main>

        {/* Tab bar mobile (disembunyikan di mode fokus) */}
        <nav
          hidden={focus}
          aria-label="Navigasi cepat"
          className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {tabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              const badge = tab.href === "/kosakata" && summary.dueCards > 0 ? summary.dueCards : null;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-16 flex-col items-center justify-center gap-1 text-[0.75rem] transition-colors duration-150",
                    active ? "font-extrabold text-primary-deep" : "font-bold text-ink-muted hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-transform duration-150 group-active:scale-90",
                      active && "bg-primary-soft",
                    )}
                  >
                    <tab.icon className={cn("size-5", active && "text-primary")} strokeWidth={2.2} aria-hidden />
                  </span>
                  {tab.short ?? tab.label}
                  {badge ? (
                    <span
                      aria-label={`${badge} jatuh tempo`}
                      className="absolute right-[calc(50%-26px)] top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mango px-1 text-[0.6875rem] font-extrabold text-mango-on"
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={openDrawer}
              aria-expanded={drawerOpen}
              aria-controls="menu-navigasi"
              className={cn(
                "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 text-[0.75rem] transition-colors",
                !tabActive ? "font-extrabold text-primary-deep" : "font-bold text-ink-muted hover:text-ink",
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
