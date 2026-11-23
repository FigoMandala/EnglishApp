"use client";

import {
  BookOpen,
  ChevronDown,
  Dumbbell,
  Flame,
  GraduationCap,
  Layers,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Settings,
  ShieldCheck,
  SpellCheck,
  Trophy,
  UserRound,
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

import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** `locked`: menu dimatikan di UI (tampil dengan gembok, tidak bisa diklik). Alamatnya sendiri tidak diblokir. */
export type NavLink = { href: string; label: string; icon: typeof GraduationCap; short?: string; locked?: boolean };

const LOCKED_HINT = "Belum dibuka";

type NavGroup = { title: string; items: NavLink[] };

const GROUPS: NavGroup[] = [
  {
    title: "Tes & motivasi",
    items: [
      { href: "/toefl", label: "TOEFL ITP", short: "TOEFL ITP", icon: GraduationCap },
      { href: "/materi", label: "Materi Structure", short: "Materi", icon: BookOpen },
      { href: "/latihan/structure", label: "Latihan Structure", short: "Latihan", icon: Dumbbell },
    ],
  },
  // Menu yang dikunci dilipat supaya tidak memenuhi sidebar; kuncinya tetap, tinggal diaktifkan lagi.
  {
    title: "Segera hadir",
    items: [
      { href: "/liga", label: "Liga mingguan", short: "Liga", icon: Trophy, locked: true },
      { href: "/streak", label: "Streak", short: "Streak", icon: Flame, locked: true },
      { href: "/belajar", label: "Jalur Belajar", short: "Jalur", icon: Layers, locked: true },
      { href: "/kosakata", label: "Kosakata", short: "Kosa", icon: SpellCheck, locked: true },
      { href: "/latihan", label: "Latihan Bebas", short: "Latihan", icon: Dumbbell, locked: true },
      { href: "/writing", label: "Writing Coach", short: "Nulis", icon: PenLine, locked: true },
      { href: "/tutor", label: "Tutor AI", short: "Tutor", icon: MessageCircle, locked: true },
    ],
  },
];

/** Tujuan utama di tab bar bawah (mobile). Sisanya lewat tombol Lainnya. */
const TAB_HREFS = ["/toefl", "/liga", "/streak"];

/**
 * Mode fokus: saat mengerjakan soal atau mengulang kartu, tab bar bawah disembunyikan
 * supaya layar HP penuh untuk soal. Menu tetap bisa dibuka dari header.
 */
function isFocusMode(pathname: string, params: URLSearchParams) {
  if (pathname === "/toefl" && params.has("s")) return true;
  if (pathname === "/toefl/simulasi" && params.has("p")) return true;
  if (pathname === "/kosakata" && params.has("review")) return true;
  return false;
}

/** Mode latihan layar penuh (tanpa sidebar): header progres + footer aksi. */
const BARE_ROUTES = ["/latihan/dengar", "/latihan/ucapkan", "/latihan/pasangan", "/kosakata/review"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const nf = new Intl.NumberFormat("id-ID");

function NavBadge({
  href,
  summary,
  variant = "panel",
}: {
  href: string;
  summary: ShellSummary;
  /** "panel" untuk sidebar & drawer; "tab" untuk badge kecil absolut di tab bar bawah. */
  variant?: "panel" | "tab";
}) {
  const tab = variant === "tab";
  if (href === "/kosakata" && summary.dueCards > 0) {
    return (
      <span
        aria-label={`${summary.dueCards} kartu jatuh tempo`}
        className={cn(
          "flex items-center justify-center rounded-full bg-mango font-extrabold text-mango-on",
          tab
            ? "absolute right-[calc(50%-26px)] top-2 h-[18px] min-w-[18px] px-1 text-[0.75rem]"
            : "h-[22px] min-w-[26px] px-[7px] text-[0.75rem]",
        )}
      >
        {summary.dueCards}
      </span>
    );
  }
  if (href === "/latihan" && summary.openMistakes > 0) {
    return (
      <span
        aria-label={`${summary.openMistakes} kesalahan belum ditebus`}
        className={cn(
          "flex items-center justify-center rounded-full bg-brick-soft font-extrabold text-brick-deep",
          tab
            ? "absolute right-[calc(50%-26px)] top-2 h-[18px] min-w-[18px] border border-brick-line px-1 text-[0.75rem]"
            : "h-[22px] min-w-[26px] border-2 border-brick-line px-1.5 text-[0.75rem]",
        )}
      >
        {summary.openMistakes}
      </span>
    );
  }
  if (href === "/toefl" && summary.daysToTest !== null) {
    return (
      <span
        aria-label={`Tes TOEFL ITP ${summary.daysToTest} hari lagi`}
        className={cn(
          "flex items-center rounded-full bg-sun font-extrabold text-sun-ink",
          tab
            ? "absolute right-[calc(50%-26px)] top-2 h-[18px] px-1 text-[0.75rem]"
            : "h-[22px] px-2 text-[0.75rem]",
        )}
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
  // Sidebar desktop yang diciutkan; pilihan per-browser, jadi cukup localStorage.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
    } catch {}
  }, []);
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
    } catch {}
  }
  // Pemicu drawer yang terakhir (tombol menu di header atau tab "Lainnya" di
  // tab bar): fokus dikembalikan ke sini saat drawer ditutup, bukan selalu ke
  // tombol menu header.
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  function openDrawer() {
    // Kalau drawer sedang dalam animasi keluar, batalkan supaya panel tidak
    // langsung ter-unmount oleh onTransitionEnd saat kembali dibuka.
    setDrawerClosing(false);
    if (!drawerOpen) {
      lastFocusedRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setDrawerOpen(true);
  }

  const closeDrawer = useCallback(() => {
    if (!drawerOpen || drawerClosing) return;
    // Di bawah "kurangi gerakan" transisi exit dimatikan global, jadi
    // onTransitionEnd tidak akan menyala — tutup langsung tanpa state closing.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawerOpen(false);
      return;
    }
    setDrawerClosing(true);
  }, [drawerOpen, drawerClosing]);
  const closeRef = useRef<HTMLButtonElement>(null);
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawerRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Kembalikan fokus ke elemen yang membuka drawer (bisa tombol menu di
      // header atau tab "Lainnya" di tab bar), bukan selalu tombol menu.
      lastFocusedRef.current?.focus();
    };
  }, [drawerOpen]);

  // iOS Safari mengabaikan overflow:hidden; kunci scroll dengan position:fixed.
  useBodyScrollLock(drawerOpen);

  const initials = (displayName || username).slice(0, 2).toUpperCase();

  // Drill & mode ujian/soal TOEFL ITP: layar penuh tanpa sidebar (runner punya header sendiri).
  if (BARE_ROUTES.some((route) => pathname === route) || (focus && pathname.startsWith("/toefl"))) {
    return <div className="min-h-screen bg-canvas">{children}</div>;
  }

  const statCell =
    "flex h-11 items-center justify-center gap-1.5 font-round text-[0.9375rem] font-extrabold text-ink transition-colors hover:bg-canvas first:rounded-l-[12px] last:rounded-r-[12px]";
  const statStrip = (
    <div className="grid grid-cols-3 divide-x-2 divide-hairline-soft rounded-[14px] border-2 border-hairline bg-surface">
      <Link href="/streak" aria-label={`Streak ${summary.streak} hari`} className={statCell}>
        <Flame className={cn("size-[18px] fill-mango text-mango-deep", summary.streak > 0 && "flick")} strokeWidth={2} aria-hidden />
        {summary.streak}
      </Link>
      <Link href="/progres" aria-label={`${nf.format(summary.xp)} XP total`} className={statCell}>
        <Zap className="size-4 fill-primary-bright text-primary-deep" strokeWidth={2} aria-hidden />
        {nf.format(summary.xp)}
      </Link>
      <Link href="/liga" aria-label={`Level ${summary.level}`} className={statCell}>
        <Trophy className="size-4 text-sky-deep" strokeWidth={2.4} aria-hidden />
        Lv {summary.level}
      </Link>
    </div>
  );


  const dayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const weekSummary = summary.week
    .map((day, i) => `${dayLabels[i]} ${day.active ? "aktif" : day.future ? "belum tiba" : "tidak aktif"}`)
    .join(", ");
  const streakCard = (
    <div role="group" aria-label="Streak dan XP" className="flex flex-col gap-3.5 rounded-[18px] bg-white/[0.08] p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-sun text-sun-ink">
          <Flame className={cn("size-5", summary.streak > 0 && "flick")} strokeWidth={2.2} />
        </span>
        <span className="leading-tight">
          <strong className="block font-display text-[1.5rem] font-black">{summary.streak} hari</strong>
          <span className="text-[0.8125rem] text-charcoal-muted">berturut-turut</span>
        </span>
      </div>
      <div role="img" aria-label={`Pekan ini: ${weekSummary}`} className="flex justify-between">
        {summary.week.map((day, i) => (
          <span key={dayLabels[i]} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "size-[22px] rounded-full",
                day.active ? "bg-sun" : "border-2 border-white/25",
                day.today && "shadow-[0_0_0_3px_var(--color-forest),0_0_0_5px_var(--color-sun)]",
              )}
            />
            <span className={cn("text-[0.6875rem]", day.today ? "font-extrabold text-charcoal-ink" : "text-charcoal-muted")}>
              {dayLabels[i]}
            </span>
          </span>
        ))}
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-[0.8125rem] text-charcoal-muted">
          <span>
            <strong className="tnum text-charcoal-ink">{nf.format(summary.xp)}</strong> XP
          </span>
          <span>
            Lv {summary.level} → {summary.level + 1}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Menuju level ${summary.level + 1}`}
          aria-valuenow={summary.xpIntoLevel}
          aria-valuemin={0}
          aria-valuemax={summary.xpForNext}
          className="h-1.5 overflow-hidden rounded-full bg-white/15"
        >
          <div
            className="h-full rounded-full bg-sun"
            style={{ width: `${summary.xpForNext > 0 ? Math.round((summary.xpIntoLevel / summary.xpForNext) * 100) : 100}%` }}
          />
        </div>
      </div>
    </div>
  );

  const countdownCard =
    summary.daysToTest !== null ? (
      <Link
        href="/toefl#target"
        aria-label={`Tes TOEFL ITP ${summary.daysToTest} hari lagi${summary.testDate ? `, ${formatDate(summary.testDate)}` : ""}`}
        className="mx-3.5 mb-3.5 flex items-center justify-between gap-3 rounded-[18px] bg-sun px-[18px] py-4 text-sun-ink transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal-ink"
      >
        <span className="leading-tight">
          <span className="eyebrow block">Tes TOEFL ITP</span>
          {summary.testDate ? <span className="text-[0.875rem] font-bold">{formatDate(summary.testDate)}</span> : null}
        </span>
        <span className="text-right leading-none">
          <strong className="block font-display text-[2.5rem] font-black tracking-[-0.03em]">{summary.daysToTest}</strong>
          <span className="text-[0.75rem] font-extrabold">hari lagi</span>
        </span>
      </Link>
    ) : (
      <Link
        href="/toefl#target"
        className="mx-3.5 mb-3.5 flex min-h-11 items-center justify-center rounded-[18px] border-2 border-dashed border-white/25 px-[18px] py-3.5 text-center text-[0.875rem] font-bold text-charcoal-muted transition-[color,border-color] duration-150 hover:border-white/50 hover:text-charcoal-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal-ink"
      >
        Atur tanggal tes
      </Link>
    );

  const renderNavItem = (link: NavLink) => {
    const active = isActive(pathname, link.href);
    if (collapsed)
      return (
        <Link
          key={link.href}
          href={link.href}
          aria-label={link.label}
          title={link.label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex size-11 items-center justify-center rounded-control transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-90",
            active ? "bg-canvas text-forest" : "text-charcoal-muted hover:bg-white/10 hover:text-charcoal-ink",
          )}
        >
          <link.icon className="size-5" strokeWidth={2.2} aria-hidden />
        </Link>
      );
    if (link.locked)
      return (
        <div
          key={link.href}
          aria-disabled="true"
          title={LOCKED_HINT}
          className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-control px-3 text-[0.9375rem] font-semibold text-charcoal-muted/70"
        >
          <link.icon className="size-5 shrink-0" strokeWidth={2.2} aria-hidden />
          <span className="flex-1">{link.label}</span>
          <Lock className="size-4 shrink-0" aria-label={LOCKED_HINT} />
        </div>
      );
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-[0.9375rem] transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun active:scale-[0.97]",
          active
            ? "bg-canvas font-extrabold text-forest"
            : "font-bold text-charcoal-ink/80 hover:bg-white/10 hover:text-charcoal-ink",
        )}
      >
        <link.icon
          className={cn("size-5 shrink-0", active ? "text-forest" : "text-charcoal-muted group-hover:text-charcoal-ink")}
          strokeWidth={2.2}
          aria-hidden
        />
        <span className="flex-1">{link.label}</span>
        <NavBadge href={link.href} summary={summary} />
      </Link>
    );
  };

  const navList = () =>
    GROUPS.map((group, index) =>
      group.items.every((link) => link.locked) ? (
        <details key={group.title} className="group/soon mt-[18px]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-control px-3 text-charcoal-muted hover:bg-white/10 [&::-webkit-details-marker]:hidden">
            <span className="eyebrow">
              {group.title} · {group.items.length}
            </span>
            <ChevronDown className="size-4 transition-transform group-open/soon:rotate-180" aria-hidden />
          </summary>
          <div className="mt-1 flex flex-col gap-0.5">{group.items.map(renderNavItem)}</div>
        </details>
      ) : (
        <div key={group.title} className={cn(index > 0 && "mt-[18px]")}>
          <p className="eyebrow px-3 pb-1.5 text-charcoal-muted">{group.title}</p>
          <div className="flex flex-col gap-0.5">{group.items.map(renderNavItem)}</div>
        </div>
      ),
    );

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
          className="flex min-h-11 items-center gap-2.5 rounded-control border-2 border-hairline bg-surface px-3 text-[0.875rem] font-bold text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
        >
          <ShieldCheck className="size-4 text-mango-deep" aria-hidden />
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
        <Link
          href="/pengaturan"
          aria-label="Pengaturan akun"
          title="Pengaturan akun"
          className="flex size-11 items-center justify-center rounded-[12px] border-2 border-hairline bg-surface text-ink-subtle transition-colors hover:border-hairline-strong hover:text-ink"
        >
          <Settings className="size-[18px]" aria-hidden />
        </Link>
        <SoundToggle />
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Keluar"
            title="Keluar"
            className="flex size-11 cursor-pointer items-center justify-center rounded-[12px] border-2 border-hairline bg-surface text-ink-subtle transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:border-brick-line hover:text-brick-deep active:scale-95"
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
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 overflow-hidden bg-forest text-charcoal-ink transition-[width] duration-300 ease-[var(--ease-drawer)] lg:block",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        {/* Lebar isi tetap (bukan mengikuti aside) supaya tidak "terperas" selagi lebar beranimasi. */}
        <div className={cn("flex h-full flex-col", collapsed ? "w-[76px]" : "w-[264px]")}>
          <div
            className={cn(
              "flex h-[76px] shrink-0 items-center",
              collapsed ? "justify-center" : "justify-between pl-[18px] pr-3",
            )}
          >
            {collapsed ? null : <Logo href="/toefl" size={36} tone="light" />}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
              title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
              className="flex size-11 cursor-pointer items-center justify-center rounded-control text-charcoal-muted transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-white/10 hover:text-charcoal-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun active:scale-90"
            >
              {collapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
            </button>
          </div>
          <div key={String(collapsed)} className="side-fade scroll-quiet flex flex-1 flex-col overflow-y-auto">
            {collapsed ? (
              <nav className="flex flex-col items-center gap-1 py-3" aria-label="Navigasi utama">
                {allLinks.filter((link) => !link.locked).map(renderNavItem)}
              </nav>
            ) : (
              <>
                <div className="px-3.5 pt-1">{streakCard}</div>
                <nav className="flex-1 px-3.5 py-[22px]" aria-label="Navigasi utama">
                  {navList()}
                </nav>
                {countdownCard}
              </>
            )}
          </div>
          <div className={cn(collapsed ? "flex flex-col items-center gap-2 pb-3.5" : "px-3.5 pb-3.5")}>
            <UserMenu
              avatar={avatar}
              name={displayName || `@${username}`}
              handle={`@${username} · ${isAdmin ? "Admin" : "Pengguna"}`}
              isAdmin={isAdmin}
              collapsed={collapsed}
              logoutAction={logoutAction}
              pathname={pathname}
            />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <header className="sticky top-0 z-30 border-b-2 border-hairline bg-canvas/95 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden">
          <div className="flex h-[60px] items-center gap-2 px-4 sm:px-6">
            <Logo href="/toefl" size={34} showText={false} />
            <span className="flex-1" />
            {!focus && (
              <>
                <Link
                  href="/streak"
                  aria-label={`Streak ${summary.streak} hari`}
                  className="flex h-11 items-center gap-1 rounded-[10px] bg-mango-soft px-2.5 font-round text-[1rem] font-extrabold text-mango-ink"
                >
                  <Flame className="size-4 fill-mango text-mango-deep" strokeWidth={2} aria-hidden />
                  {summary.streak}
                </Link>
                <Link
                  href="/progres"
                  aria-label={`${nf.format(summary.xp)} XP`}
                  className="flex h-11 items-center gap-1 rounded-[10px] bg-primary-soft px-2.5 font-round text-[1rem] font-extrabold text-primary-deep"
                >
                  <Zap className="size-3.5 fill-primary-bright text-primary-deep" strokeWidth={2} aria-hidden />
                  {nf.format(summary.xp)}
                </Link>
              </>
            )}
            <button
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
              className="drawer-backdrop absolute inset-0 bg-ink/45 transition-opacity duration-200 ease-[var(--ease-out)]"
              style={{ opacity: drawerClosing ? 0 : 1 }}
              onClick={closeDrawer}
              aria-hidden
            />
            <div
              id="menu-navigasi"
              role="dialog"
              aria-modal="true"
              aria-label="Menu lainnya"
              onTransitionEnd={(e) => {
                if (e.target === e.currentTarget && e.propertyName === "transform" && drawerClosing) {
                  setDrawerOpen(false);
                  setDrawerClosing(false);
                }
              }}
              style={{
                transform: drawerClosing ? "translateX(100%)" : "translateX(0)",
                transitionProperty: "transform",
                transitionTimingFunction: "var(--ease-drawer)",
                transitionDuration: drawerClosing ? "240ms" : "300ms",
              }}
              className="drawer-panel absolute inset-y-0 right-0 flex w-[min(22rem,90vw)] flex-col border-l-2 border-hairline bg-canvas shadow-overlay"
            >
              <div className="flex h-[60px] items-center justify-between border-b-2 border-hairline px-4">
                <span className="font-display text-[1.375rem] font-black text-ink">Lainnya</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Tutup menu"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-control text-ink-subtle transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] hover:bg-surface hover:text-ink active:scale-95"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="scroll-quiet flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
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
                <nav aria-label="Navigasi" className="grid grid-cols-2 gap-2.5">
                  {allLinks
                    .filter((link) => !link.locked)
                    .map((link) => {
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
                <details className="group/soon rounded-[18px] border-2 border-hairline bg-surface-muted">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3.5 text-ink-faint [&::-webkit-details-marker]:hidden">
                    <span className="eyebrow">Segera hadir · {allLinks.filter((link) => link.locked).length}</span>
                    <ChevronDown className="size-4 transition-transform group-open/soon:rotate-180" aria-hidden />
                  </summary>
                  <div className="grid grid-cols-2 gap-2 p-2.5 pt-0">
                    {allLinks
                      .filter((link) => link.locked)
                      .map((link) => (
                        <div
                          key={link.href}
                          aria-disabled="true"
                          className="flex min-h-[64px] cursor-not-allowed items-center gap-2 rounded-[14px] border-2 border-hairline bg-surface px-3 text-ink-faint"
                        >
                          <link.icon className="size-5 shrink-0" strokeWidth={2.2} aria-hidden />
                          <strong className="flex-1 text-[0.8125rem] leading-tight">{link.label}</strong>
                          <Lock className="size-3.5 shrink-0" aria-label={LOCKED_HINT} />
                        </div>
                      ))}
                  </div>
                </details>
              </div>
              <div className="border-t-2 border-hairline p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{userCard}</div>
            </div>
          </div>
        ) : null}

        <main
          id="konten"
          inert={drawerOpen}
          className={cn("flex-1 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10", focus ? "pb-10" : "pb-28")}
        >
          <div className="mx-auto max-w-[1120px]">
            {children}
          </div>
        </main>

        {/* Tab bar mobile (disembunyikan di mode fokus) */}
        <nav
          hidden={focus}
          inert={drawerOpen}
          aria-label="Navigasi cepat"
          className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {tabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              if (tab.locked)
                return (
                  <div
                    key={tab.href}
                    aria-disabled="true"
                    className="flex min-h-16 cursor-not-allowed flex-col items-center justify-center gap-1 text-[0.75rem] font-bold text-ink-faint"
                  >
                    <span className="relative flex h-7 w-12 items-center justify-center">
                      <tab.icon className="size-5" strokeWidth={2.2} aria-hidden />
                      <Lock className="absolute right-1 top-0 size-3" aria-label={LOCKED_HINT} />
                    </span>
                    {tab.short ?? tab.label}
                  </div>
                );
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
                      "flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,transform] duration-150 ease-[var(--ease-out)] group-active:scale-95",
                      active && "bg-primary-soft",
                    )}
                  >
                    <tab.icon className={cn("size-5", active && "text-primary")} strokeWidth={2.2} aria-hidden />
                  </span>
                  {tab.short ?? tab.label}
                  <NavBadge href={tab.href} summary={summary} variant="tab" />
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

/** Kartu pengguna di sidebar: klik membuka menu akun (pengaturan, profil, keluar). */
function UserMenu({
  avatar,
  name,
  handle,
  isAdmin,
  collapsed,
  logoutAction,
  pathname,
}: {
  avatar: ReactNode;
  name: string;
  handle: string;
  isAdmin: boolean;
  collapsed: boolean;
  logoutAction: () => Promise<void>;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const settingsActive = pathname.startsWith("/pengaturan");

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (collapsed)
    return (
      <>
        {isAdmin ? (
          <Link
            href="/admin"
            aria-label="Mode Admin"
            title="Mode Admin"
            className="flex size-11 items-center justify-center rounded-control text-sun hover:bg-white/10"
          >
            <ShieldCheck className="size-5" aria-hidden />
          </Link>
        ) : null}
        <Link
          href="/pengaturan"
          aria-label="Pengaturan akun"
          title={name}
          aria-current={settingsActive ? "page" : undefined}
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun"
        >
          {avatar}
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Keluar"
            title="Keluar"
            className="flex size-11 cursor-pointer items-center justify-center rounded-control text-charcoal-muted hover:bg-white/10 hover:text-brick-line"
          >
            <LogOut className="size-[18px]" aria-hidden />
          </button>
        </form>
      </>
    );

  const item =
    "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 text-left text-[0.9375rem] font-bold text-ink transition-colors hover:bg-canvas";

  return (
    <div ref={root} className="relative">
      {open ? (
        <div
          role="menu"
          aria-label="Akun"
          className="pop absolute inset-x-0 bottom-[calc(100%+8px)] z-20 origin-bottom rounded-[18px] bg-surface p-2 text-ink shadow-overlay"
        >
          <div className="px-3 pb-2 pt-2.5">
            <strong className="block truncate text-[0.9375rem]">{name}</strong>
            <span className="block truncate text-[0.8125rem] text-ink-subtle">{handle}</span>
          </div>
          <div className="mx-2 my-1 h-px bg-hairline-soft" />
          <Link href="/pengaturan" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <Settings className="size-5 text-ink-subtle" aria-hidden />
            Pengaturan akun
          </Link>
          <Link href="/progres" role="menuitem" onClick={() => setOpen(false)} className={item}>
            <UserRound className="size-5 text-ink-subtle" aria-hidden />
            Profil &amp; progres
          </Link>
          {isAdmin ? (
            <Link href="/admin" role="menuitem" onClick={() => setOpen(false)} className={item}>
              <ShieldCheck className="size-5 text-mango-deep" aria-hidden />
              Mode Admin
            </Link>
          ) : null}
          <div className="mx-2 my-1 h-px bg-hairline-soft" />
          <form action={logoutAction}>
            <button type="submit" role="menuitem" className={cn(item, "text-brick-deep hover:bg-brick-soft")}>
              <LogOut className="size-5" aria-hidden />
              Keluar
            </button>
          </form>
        </div>
      ) : null}
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Akun: ${name}`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2.5 rounded-[16px] p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun",
          open || settingsActive ? "bg-white/[0.16]" : "bg-white/[0.08] hover:bg-white/[0.12]",
        )}
      >
        {avatar}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[0.875rem] font-extrabold text-charcoal-ink">{name}</span>
          <span className="block truncate text-[0.75rem] font-semibold text-charcoal-muted">Akun &amp; pengaturan</span>
        </span>
        <ChevronDown
          className={cn("size-[18px] shrink-0 text-charcoal-muted transition-transform duration-200", !open && "rotate-180")}
          aria-hidden
        />
      </button>
    </div>
  );
}
