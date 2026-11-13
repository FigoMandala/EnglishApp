"use client";

import { Clock, Shield } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { CountUp } from "@/components/fx/count-up";
import { Lori } from "@/components/mascot";
import { Switch } from "@/components/ui/switch";
import { LEAGUE_TIERS, type LeagueRow } from "@/lib/league";
import { cn } from "@/lib/utils";

import { setLeagueOptInAction } from "./actions";
import { todayISO } from "@/lib/srs";

const AVATARS = ["#bcd3f6", "#f6c9bd", "#d5bfe6", "#bfe0cb", "#f2c878"];
const initials = (name: string) => name.slice(0, 2).toUpperCase();
const colorFor = (id: number) => AVATARS[id % AVATARS.length];

export function LeagueView({
  optIn,
  tier,
  weekXp,
  lastWeekXp,
  rows,
  rank,
  next,
  end,
}: {
  optIn: boolean;
  tier: number;
  weekXp: number;
  lastWeekXp: number;
  rows: LeagueRow[];
  rank: number | null;
  next: { name: string; gap: number } | null;
  end: string;
}) {
  const [on, setOn] = useState(optIn);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = LEAGUE_TIERS[tier];
  const top = Math.max(1, ...rows.map((r) => r.xp));
  const daysLeft = Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(todayISO() + "T00:00:00Z")) / 86_400_000));
  const peak = Math.max(1, weekXp, lastWeekXp);

  function toggle(next: boolean) {
    setOn(next);
    setError(null);
    startTransition(async () => {
      try {
        await setLeagueOptInAction(next);
      } catch {
        // Batalkan optimisme: kembalikan saklar agar sesuai keadaan server.
        setOn(!next);
        setError("Gagal mengubah status liga. Coba lagi.");
      }
    });
  }

  const nextTier = LEAGUE_TIERS[tier + 1];
  const MEDAL = ["bg-mango text-mango-on", "bg-[#d6d9de] text-ink", "bg-[#e0a84e] text-mango-on"];
  const change = lastWeekXp > 0 ? Math.round(((weekXp - lastWeekXp) / lastWeekXp) * 100) : null;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow text-ink-subtle">Liga mingguan</p>
          <h1 className="font-display text-[2.25rem] font-black leading-[1.1] tracking-[-0.02em]">
            {on ? `Liga ${current.name}` : "Mode santai"}
          </h1>
          <p className="text-ink-subtle">
            Liga ditentukan dari levelmu.
            {nextTier ? ` Naik ke Level ${nextTier.minLevel} untuk pindah ke ${nextTier.name}.` : " Kamu di liga tertinggi."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {on ? (
            <span className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-hairline bg-surface px-4 font-extrabold">
              <Clock className="size-4 text-mango-deep" aria-hidden />
              {daysLeft === 0 ? "Selesai hari ini" : `Selesai dalam ${daysLeft} hari`}
            </span>
          ) : null}
          <span className="inline-flex h-11 items-center gap-3 rounded-full border-2 border-hairline bg-surface pl-4 pr-2">
            <span id="sw-l" className="text-[0.875rem] font-extrabold">
              Ikut liga
            </span>
            <Switch checked={on} onChange={toggle} labelledBy="sw-l" disabled={pending} />
          </span>
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-[12px] bg-brick-soft px-4 py-2.5 text-[0.875rem] font-bold text-brick-deep">
          {error}
        </p>
      ) : null}

      {on ? (
        <ol
          aria-label="Tingkatan liga"
          className="grid grid-cols-5 gap-1.5 rounded-[24px] border-2 border-hairline bg-surface px-2.5 py-3 text-center sm:gap-3 sm:px-5 sm:py-[18px]"
        >
          {LEAGUE_TIERS.map((t, i) => {
            const cur = i === tier;
            return (
              <li
                key={t.name}
                aria-current={cur ? "true" : undefined}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1.5 rounded-[16px] p-1.5 sm:p-2",
                  cur ? "border-2 bg-surface-muted" : "opacity-55",
                )}
                style={cur ? { borderColor: t.fill } : undefined}
              >
                <Shield
                  className={cn("size-8 sm:size-10", cur && "float")}
                  strokeWidth={1.8}
                  style={{ color: t.stroke, fill: t.fill }}
                  aria-hidden
                />
                <span
                  title={t.name}
                  className={cn("w-full max-w-full truncate px-0.5 text-[0.75rem] leading-tight tracking-tight sm:text-[0.8125rem] sm:tracking-normal", cur ? "font-black" : "font-extrabold")}
                >
                  {t.name}
                  {cur ? <span className="hidden sm:inline"> · kamu</span> : null}
                </span>
                <span className="text-[0.75rem] text-ink-subtle">Lv {t.minLevel}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        {on ? (
          <section aria-label="Peringkat" className="min-w-0 flex-[1_1_520px] overflow-hidden rounded-[24px] border-2 border-hairline bg-surface">
            <ol>
              {rows.map((r, i) => (
                <li
                  key={r.userId}
                  aria-current={r.isMe ? "true" : undefined}
                  className={cn(
                    "rise flex items-center gap-3.5 px-5 py-3.5",
                    r.isMe ? "border-y-2 border-primary-line bg-primary-soft" : i > 0 && "border-t-2 border-hairline-soft",
                  )}
                  style={{ "--i": Math.min(i, 8) } as React.CSSProperties}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full font-round text-base font-extrabold",
                      r.isMe ? "bg-primary text-white" : i < 3 ? MEDAL[i] : "text-ink-subtle",
                    )}
                  >
                    {r.rank}
                  </span>
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full text-[0.875rem] font-black"
                    style={{ background: colorFor(r.userId) }}
                  >
                    {initials(r.name)}
                  </span>
                  <strong className={cn("min-w-0 flex-1 truncate", r.isMe && "text-primary-deep")}>
                    {r.isMe ? `${r.name} (kamu)` : r.name}
                  </strong>
                  <span className={cn("hidden h-2 w-40 shrink-0 overflow-hidden rounded-full sm:block", r.isMe ? "bg-surface" : "bg-surface-sunken")}>
                    <span
                      className={cn("grow-x block h-full rounded-full", r.isMe ? "bg-primary" : "bg-ink-muted")}
                      style={{ width: `${Math.round((r.xp / top) * 100)}%`, animationDelay: "calc(var(--i, 0) * 60ms)" }}
                    />
                  </span>
                  <span className={cn("w-[76px] shrink-0 text-right font-round text-[1.125rem] font-extrabold", r.isMe && "text-primary-deep")}>
                    {r.xp} XP
                  </span>
                </li>
              ))}
            </ol>
            {rows.length < 2 ? (
              <p className="border-t-2 border-hairline-soft px-5 py-4 text-[0.9375rem] text-ink-subtle">
                Belum ada pengguna lain di ligamu. Ajak temanmu ikut, atau kumpulkan XP sendiri dulu.
              </p>
            ) : null}
            <p className="border-t-2 border-hairline-soft bg-surface-muted px-5 py-3 text-[0.8125rem] text-ink-subtle">
              Dengan ikut liga, nama penggunamu terlihat oleh pengguna lain di liga yang sama. Matikan kapan saja.
            </p>
          </section>
        ) : (
          <section className="pop flex min-w-0 flex-[1_1_520px] flex-wrap items-center gap-6 rounded-[24px] border-2 border-hairline bg-surface p-7 shadow-card">
            <Lori mood="idle" size={150} label="Lori santai" />
            <div className="min-w-[240px] flex-1">
              <h2 className="font-display text-[1.5rem] font-black">Lawanmu cuma kamu minggu lalu</h2>
              <p className="mt-1.5 text-ink-subtle">
                Tidak ada peringkat dan tidak ada nama yang terlihat orang lain. XP tetap dihitung untuk level dan target harian.
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                {[
                  { label: "Minggu lalu", xp: lastWeekXp, cls: "bg-locked-ledge", ink: "" },
                  { label: "Minggu ini", xp: weekXp, cls: "bg-primary", ink: "text-primary-deep" },
                ].map((bar) => (
                  <div key={bar.label} className="grid grid-cols-[110px_1fr_70px] items-center gap-2.5">
                    <span className={cn("font-extrabold", bar.ink)}>{bar.label}</span>
                    <span className="h-3.5 overflow-hidden rounded-full bg-surface-sunken">
                      <span className={cn("grow-x block h-full rounded-full", bar.cls)} style={{ width: `${Math.round((bar.xp / peak) * 100)}%` }} />
                    </span>
                    <span className="text-right font-round font-extrabold">{bar.xp} XP</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <aside aria-label="Tips dan hasil" className="flex min-w-[280px] flex-[0_1_340px] flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[24px] bg-primary p-[22px] text-white shadow-[0_5px_0_var(--color-primary-deep)]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[0.75rem] font-extrabold tracking-[0.08em] text-primary-soft">POSISIMU</span>
                <span className="font-round text-[2.5rem] font-extrabold leading-none">
                  {on && rank ? (
                    <>
                      #<CountUp to={rank} className="" />
                    </>
                  ) : (
                    "–"
                  )}
                </span>
              </div>
              <div>
                <span className="block text-[0.75rem] font-extrabold tracking-[0.08em] text-primary-soft">XP MINGGU INI</span>
                <span className="font-round text-[2.5rem] font-extrabold leading-none">
                  <CountUp to={weekXp} className="tnum" />
                </span>
              </div>
            </div>
            {on ? (
              <span className="rounded-[14px] bg-primary-deep px-3 py-2.5 text-[0.9375rem] font-extrabold">
                {next ? `${next.gap} XP lagi buat salip ${next.name}` : rank === 1 ? "Kamu memimpin minggu ini" : "Kumpulkan XP untuk naik peringkat"}
              </span>
            ) : null}
            <span className="text-[0.8125rem] text-primary-soft">
              Minggu lalu: {lastWeekXp} XP{change !== null ? ` (${change >= 0 ? "+" : ""}${change}%)` : ""}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[24px] border-2 border-hairline bg-surface p-5">
            <span className="eyebrow text-ink-subtle">XP paling efektif</span>
            {[
              { href: "/latihan/kesalahan", label: "Tebus pola kesalahan", xp: "+5/soal" },
              { href: "/latihan/pasangan", label: "Pasangan tanpa salah", xp: "+40" },
              { href: "/latihan/dengar", label: "Dengar & jawab penuh", xp: "+40" },
            ].map((tip) => (
              <Link
                key={tip.href}
                href={tip.href}
                className="flex justify-between rounded-[12px] bg-surface-muted px-3 py-2.5 text-[0.875rem] font-bold text-ink hover:bg-surface-sunken"
              >
                <span>{tip.label}</span>
                <span className="font-extrabold text-mango-deep">{tip.xp}</span>
              </Link>
            ))}
            <p className="text-[0.75rem] text-ink-subtle">
              Soal grammar memberi XP hanya saat pertama kali benar, dan mode latihan dibatasi 120 XP per hari.
            </p>
          </div>

          {on ? (
            <div className="flex items-center gap-3 rounded-[20px] border-2 border-dashed border-hairline-strong p-4">
              <Lori mood="wave" size={56} className="shrink-0" />
              <span className="text-[0.875rem] text-ink-muted">
                <strong>Tidak suka bersaing?</strong> Matikan “Ikut liga”: lawanmu cuma kamu minggu lalu.
              </span>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
