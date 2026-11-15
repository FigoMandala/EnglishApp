import { ArrowLeft, Download, LogOut } from "lucide-react";
import Link from "next/link";

import { PushToggle } from "@/components/push-toggle";
import { getEptrTarget, getEptrTrend } from "@/db/queries/activity";
import { totalXp } from "@/db/queries/learning";
import { getStreakState } from "@/db/queries/streak";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { levelFromXp } from "@/lib/xp";

import { logout } from "../actions";
import { PasswordForm, ProfileForm } from "./settings-forms";

export const metadata = { title: "Pengaturan akun · EnglishApp" };

const card = "pengaturan-card rise p-6 sm:p-8";
const h2 = "font-display text-[1.375rem] font-extrabold tracking-[-0.02em] text-ink";
const outlineBtn =
  "inline-flex h-11 cursor-pointer items-center gap-2 rounded-[14px] bg-surface-muted px-5 text-[0.9375rem] font-extrabold transition-colors hover:bg-hairline-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky";

export default async function PengaturanPage() {
  const user = await requireUser();
  const [xp, streak, trend, target] = await Promise.all([
    totalXp(user.id),
    getStreakState(user.id, todayISO()),
    getEptrTrend(user.id),
    getEptrTarget(user.id),
  ]);
  const level = levelFromXp(xp);
  const name = user.displayName ?? "";
  const initials =
    (name || user.username)
      .split(/\s+/)
      .map((word) => [...word][0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const stats = [
    { v: String(streak.streak), l: "hari beruntun" },
    { v: `Lv ${level.level}`, l: `${xp.toLocaleString("id-ID")} XP` },
    { v: trend.length ? String(trend[trend.length - 1].total) : "-", l: "perkiraan skor" },
    { v: target ? String(target.score) : "-", l: "target skor" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1160px] pb-16">
      <Link
        href="/toefl"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-[0.9375rem] font-bold text-primary-deep hover:bg-primary-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky"
      >
        <ArrowLeft className="size-[18px]" aria-hidden />
        TOEFL ITP
      </Link>
      <h1 className="mb-8 mt-2 font-display text-[1.875rem] font-black leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
        Pengaturan akun
      </h1>

      <div className="flex flex-wrap items-start gap-7">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-7">
          <section aria-labelledby="pg-profil" className={`${card} flex flex-col gap-6`}>
            <h2 id="pg-profil" className={h2}>
              Profil
            </h2>
            <span
              aria-hidden
              className="flex size-20 items-center justify-center rounded-full bg-charcoal font-display text-[1.875rem] font-extrabold text-mango"
            >
              {initials}
            </span>
            <ProfileForm username={user.username} initialName={name} />
          </section>

          <section aria-labelledby="pg-sandi" className={`${card} flex flex-col gap-6`}>
            <div>
              <h2 id="pg-sandi" className={h2}>
                Kata sandi
              </h2>
              <p className="mt-1.5 text-[0.9375rem] text-ink-subtle">
                Minimal 8 karakter. Setelah diganti, perangkat lain keluar otomatis.
              </p>
            </div>
            <PasswordForm />
          </section>

          <section aria-labelledby="pg-pref" className={`${card} flex flex-col gap-4`}>
            <h2 id="pg-pref" className={h2}>
              Preferensi
            </h2>
            <div>
              <p className="mb-2 text-[1rem] font-extrabold text-ink">Pengingat harian</p>
              <PushToggle vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? ""} />
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 max-w-[360px] flex-[1_1_280px] flex-col gap-7">
          <section aria-labelledby="pg-ringkas" className={`${card} flex flex-col gap-5`}>
            <h2 id="pg-ringkas" className={`${h2} text-[1.25rem]`}>
              Ringkasan belajar
            </h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
              {stats.map((s) => (
                <div key={s.l} className="flex flex-col-reverse">
                  <dt className="text-[0.8125rem] font-semibold text-ink-subtle">{s.l}</dt>
                  <dd className="font-display text-[1.875rem] font-extrabold leading-none text-ink">{s.v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="pg-data" className={`${card} flex flex-col gap-3.5`}>
            <h2 id="pg-data" className={`${h2} text-[1.25rem]`}>
              Data kamu
            </h2>
            <p className="text-[0.9375rem] leading-relaxed text-ink-subtle">
              Unduh seluruh data akunmu sebagai satu berkas JSON.
            </p>
            <div>
              <a href="/api/ekspor-data" download className={`${outlineBtn} text-ink`}>
                <Download className="size-[18px]" aria-hidden />
                Ekspor data
              </a>
            </div>
            <p className="text-[0.8125rem] font-medium text-ink-subtle">Belajar sejak {formatDate(user.createdAt)}</p>
          </section>

          <section aria-labelledby="pg-sesi" className={`${card} flex flex-col gap-3.5`}>
            <h2 id="pg-sesi" className={`${h2} text-[1.25rem]`}>
              Sesi
            </h2>
            <p className="text-[0.9375rem] leading-relaxed text-ink-subtle">
              Keluar dari akun di perangkat ini. Progresmu tetap tersimpan.
            </p>
            <form action={logout}>
              <button type="submit" className={`${outlineBtn} text-brick-deep`}>
                <LogOut className="size-[18px]" aria-hidden />
                Keluar
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
