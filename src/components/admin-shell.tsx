"use client";

import { ArrowLeft, BookA, Layers, LayoutDashboard, ListChecks, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { LoriIconBadge } from "@/components/logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/admin/soal", label: "Bank Soal", icon: ListChecks },
  { href: "/admin/kosakata", label: "Kosakata", icon: BookA },
  { href: "/admin/materi", label: "Materi & Jalur", icon: Layers },
  { href: "/admin/moderasi", label: "Moderasi & AI", icon: ShieldAlert },
  { href: "/admin/pengguna", label: "Pengguna & Privasi", icon: Users },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Kerangka panel admin: sidebar gelap supaya tidak tertukar dengan aplikasi pelajar. */
export function AdminShell({ username, children }: { username: string; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#konten"
        className="sr-only z-50 rounded-control bg-ink px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Lewati ke konten
      </a>
      <aside className="flex shrink-0 flex-col gap-1 bg-charcoal px-3 py-4 text-night-muted lg:sticky lg:top-0 lg:h-dvh lg:w-64">
        <div className="flex items-center gap-2.5 px-2 pb-3">
          <LoriIconBadge size={28} />
          <span className="font-display text-lg font-extrabold text-white">EnglishApp</span>
          <span className="rounded-md bg-mango px-2 py-0.5 text-[0.6875rem] font-black tracking-[0.08em] text-mango-on">
            ADMIN
          </span>
        </div>
        <nav aria-label="Navigasi admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-3 rounded-control px-3 text-[0.9375rem] font-bold transition-colors",
                  active ? "bg-charcoal-raised text-white" : "hover:bg-charcoal-raised hover:text-white",
                )}
              >
                <link.icon className={cn("size-[1.125rem]", active && "text-mango")} aria-hidden />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-2 flex flex-col gap-2 lg:mt-auto">
          <Link
            href="/belajar"
            className="flex min-h-11 items-center gap-2 rounded-control border-2 border-charcoal-raised px-3 text-[0.875rem] font-bold hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke aplikasi
          </Link>
          <p className="px-2 text-[0.8125rem]">
            Masuk sebagai <strong className="text-white">@{username}</strong>
          </p>
        </div>
      </aside>
      <main id="konten" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div key={pathname} className="page-enter mx-auto max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
