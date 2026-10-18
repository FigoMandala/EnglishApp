"use client";

import { Shield } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Lori } from "@/components/mascot";
import { Switch } from "@/components/ui/switch";
import { LEAGUE_TIERS, type LeagueRow } from "@/lib/league";
import { cn } from "@/lib/utils";

import { setLeagueOptInAction } from "./actions";

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
  const current = LEAGUE_TIERS[tier];
  const top = Math.max(1, ...rows.map((r) => r.xp));
  const daysLeft = Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) / 86_400_000));
  const peak = Math.max(1, weekXp, lastWeekXp);

  function toggle(next: boolean) {
    setOn(next);
    startTransition(async () => {
      await setLeagueOptInAction(next);
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.875rem] font-extrabold tracking-[0.08em] text-[#17603c]">LIGA MINGGUAN</p>
            <h1 className="mt-1 font-display text-[2.25rem] font-black tracking-[-0.03em] sm:text-[2.625rem]">
              {on ? `Liga ${current.name}` : "Liga belum diikuti"}
            </h1>
          </div>
          <div className="flex items-center gap-3 rounded-[16px] border-2 border-hairline bg-surface px-3.5 py-2.5">
            <span id="sw-l" className="text-[0.9375rem] font-extrabold">
              Ikut liga
            </span>
            <Switch checked={on} onChange={toggle} labelledBy="sw-l" disabled={pending} />
          </div>
        </div>

        {on ? (
          <>
            <ol aria-label="Tingkatan liga" className="grid grid-cols-5 gap-2.5">
              {LEAGUE_TIERS.map((t, i) => {
                const cur = i === tier;
                const locked = i > tier;
                return (
                  <li key={t.name} className="pop flex flex-col items-center gap-1.5" style={{ "--i": i } as React.CSSProperties}>
                    <span className={cn("grid h-[72px] w-16 place-items-center", cur && "float")}>
                      <Shield
                        className="size-[60px]"
                        strokeWidth={1.8}
                        style={{ color: locked ? "#d6c8ae" : t.stroke, fill: locked ? "#e9e3d6" : t.fill }}
                        aria-hidden
                      />
                    </span>
                    <span className={cn("text-[0.875rem]", cur ? "font-black text-ink" : "font-bold text-[#8f8574]")}>{t.name}</span>
                  </li>
                );
              })}
            </ol>

            <div className="flex items-center justify-between gap-3 rounded-[16px] bg-mango-soft px-[18px] py-3.5 font-bold text-mango-ink">
              <span>Liga ditentukan dari levelmu. Naik level untuk pindah liga.</span>
              <span className="shrink-0 text-[0.875rem]">reset {daysLeft === 0 ? "hari ini" : `${daysLeft} hari lagi`}</span>
            </div>

            <ol
              aria-label="Peringkat"
              className="flex flex-col gap-0.5 rounded-[22px] border-2 border-hairline bg-surface p-2 shadow-[0_4px_0_var(--color-hairline)]"
            >
              {rows.map((r, i) => (
                <li
                  key={r.userId}
                  className={cn(
                    "rise grid min-h-[52px] grid-cols-[34px_40px_1fr_70px] items-center gap-3 rounded-[14px] border-2 px-3 sm:grid-cols-[34px_40px_1fr_160px_70px]",
                    r.isMe ? "border-[#9fd0b3] bg-[#eaf5ee]" : "border-transparent",
                  )}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <span className={cn("font-display text-[1.0625rem] font-black", i < 3 ? "text-primary-deep" : "text-ink-subtle")}>{i + 1}</span>
                  <span className="grid size-9 place-items-center rounded-full text-[0.8125rem] font-extrabold" style={{ background: colorFor(r.userId) }}>
                    {initials(r.name)}
                  </span>
                  <span className={cn("truncate text-[1rem]", r.isMe ? "font-black" : "font-semibold")}>{r.isMe ? `${r.name} (kamu)` : r.name}</span>
                  <span className="hidden h-2 overflow-hidden rounded-full bg-[#f1ece2] sm:block">
                    <span
                      className={cn("grow-x block h-full rounded-full", r.isMe ? "bg-primary" : "bg-[#c9bba2]")}
                      style={{ width: `${Math.round((r.xp / top) * 100)}%` }}
                    />
                  </span>
                  <span className="text-right text-[0.9375rem] font-extrabold text-ink-muted">{r.xp} XP</span>
                </li>
              ))}
            </ol>
            {rows.length < 2 ? (
              <p className="rounded-[16px] bg-canvas px-4 py-3 text-[0.9375rem] text-ink-subtle">
                Belum ada pengguna lain di ligamu. Ajak temanmu ikut, atau kumpulkan XP sendiri dulu.
              </p>
            ) : null}
            <p className="text-[0.8125rem] text-ink-subtle">
              Dengan ikut liga, nama penggunamu terlihat oleh pengguna lain di liga yang sama. Matikan kapan saja.
            </p>
          </>
        ) : (
          <div className="pop flex flex-wrap items-center gap-6 rounded-[26px] border-2 border-hairline bg-surface p-7 shadow-[0_5px_0_var(--color-hairline)]">
            <Lori mood="idle" size={170} label="Lori santai" />
            <div className="min-w-[260px] flex-1">
              <h2 className="font-display text-[1.75rem] font-black">Mode santai: lawanmu cuma kamu minggu lalu</h2>
              <p className="mt-2 text-[1rem] leading-normal text-ink-subtle">
                Tidak ada peringkat dan tidak ada nama yang terlihat orang lain. XP tetap dihitung untuk level dan target harian.
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                {[
                  { label: "Minggu lalu", xp: lastWeekXp, cls: "bg-[#c9bba2]", ink: "" },
                  { label: "Minggu ini", xp: weekXp, cls: "bg-primary", ink: "text-primary-deep" },
                ].map((bar) => (
                  <div key={bar.label} className="grid grid-cols-[110px_1fr_70px] items-center gap-2.5">
                    <span className={cn("font-extrabold", bar.ink)}>{bar.label}</span>
                    <span className="h-3.5 overflow-hidden rounded-full bg-[#f1ece2]">
                      <span className={cn("grow-x block h-full rounded-full", bar.cls)} style={{ width: `${Math.round((bar.xp / peak) * 100)}%` }} />
                    </span>
                    <span className="text-right font-extrabold">{bar.xp} XP</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <aside aria-label="Tips dan hasil" className="flex w-full flex-col gap-3.5 lg:w-[340px] lg:shrink-0">
        <div className="rise flex items-end gap-2.5 rounded-[22px] bg-primary p-[18px] text-white shadow-[0_5px_0_var(--color-primary-deep)]">
          <div className="flex-1">
            <p className="text-[0.8125rem] font-extrabold tracking-[0.08em] text-[#cfebda]">{on ? "POSISIMU" : "XP MINGGU INI"}</p>
            <p className="mt-0.5 font-display text-[2.125rem] font-black">{on ? (rank ? `#${rank}` : "–") : weekXp}</p>
            <p className="mt-0.5 text-[0.875rem] text-primary-soft">
              {on
                ? next
                  ? `${next.gap} XP lagi buat salip ${next.name}`
                  : rank === 1
                    ? "Kamu memimpin minggu ini"
                    : "Kumpulkan XP untuk naik peringkat"
                : `${lastWeekXp} XP minggu lalu`}
            </p>
          </div>
          <Lori mood={rank === 1 ? "cheer" : "idle"} size={96} />
        </div>

        <div className="rise rounded-[22px] border-2 border-hairline bg-surface p-[18px] [--i:1]">
          <h2 className="mb-2.5 font-display text-[1.125rem] font-black">XP paling efektif</h2>
          <ul className="flex flex-col gap-2.5 text-[0.9375rem]">
            <li className="flex justify-between gap-2.5">
              <Link href="/latihan/kesalahan" className="font-bold hover:underline">Tebus pola kesalahan</Link>
              <strong>+5/soal</strong>
            </li>
            <li className="flex justify-between gap-2.5">
              <Link href="/latihan/pasangan" className="font-bold hover:underline">Pasangan tanpa salah</Link>
              <strong>+40</strong>
            </li>
            <li className="flex justify-between gap-2.5">
              <Link href="/latihan/dengar" className="font-bold hover:underline">Dengar &amp; jawab penuh</Link>
              <strong>+40</strong>
            </li>
          </ul>
          <p className="mt-3 text-[0.8125rem] text-ink-subtle">
            Soal grammar hanya memberi XP saat pertama kali benar, dan mode latihan dibatasi 120 XP per hari, supaya liga adil.
          </p>
        </div>
      </aside>
    </div>
  );
}
