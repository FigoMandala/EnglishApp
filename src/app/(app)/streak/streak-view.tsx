"use client";

import { Flame, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { CountUp } from "@/components/fx/count-up";
import { Switch } from "@/components/ui/switch";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

import { setWeekendEasyAction, spendFreezeAction } from "./actions";

type Day = { n: number; date: string; status: "studied" | "frozen" | "empty"; future: boolean; today: boolean };

const MILESTONES = [
  { n: 7, reward: "Lencana Streak 7" },
  { n: 14, reward: "Dua minggu penuh" },
  { n: 30, reward: "Sebulan konsisten" },
  { n: 60, reward: "Kebiasaan terbentuk" },
  { n: 100, reward: "Seratus hari" },
];

export function StreakView({
  streak,
  longest,
  freezes,
  studiedToday,
  frozenToday,
  weekendEasy,
  monthName,
  lead,
  days,
  left,
}: {
  streak: number;
  longest: number;
  freezes: number;
  studiedToday: boolean;
  frozenToday: boolean;
  weekendEasy: boolean;
  monthName: string;
  lead: number;
  days: Day[];
  left: { hours: number; minutes: number };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [weekend, setWeekend] = useState(weekendEasy);

  const danger = streak > 0 && !studiedToday && !frozenToday;
  const next = MILESTONES.find((m) => m.n > streak) ?? MILESTONES[MILESTONES.length - 1];
  const heroBg = danger ? "bg-[#8a5a1e] [--ledge:#5e3a0f]" : frozenToday && !studiedToday ? "bg-[#224fa8] [--ledge:#0e2250]" : "bg-[#c4831f] [--ledge:#7a4b08]";
  const flame = danger ? ["#e0a84e", "#f2c878"] : frozenToday && !studiedToday ? ["#9ec0f5", "#eef3fd"] : ["#f2a93b", "#ffd98a"];

  function freeze() {
    setError(null);
    startTransition(async () => {
      const result = await spendFreezeAction();
      if (!result.ok) setError(result.message ?? "Gagal memakai pelindung.");
      else sfx.correct();
    });
  }

  function toggleWeekend(on: boolean) {
    setWeekend(on);
    startTransition(async () => {
      await setWeekendEasyAction(on);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {danger ? (
        <section
          aria-live="assertive"
          className="pop flex flex-wrap items-center gap-5 rounded-[24px] border-2 border-[#efb4a2] bg-brick-soft px-[22px] py-[18px]"
        >
          <div className="min-w-[240px] flex-1 text-brick-deep">
            <p className="font-display text-[1.5rem] font-black">
              Streak {streak} hari tinggal {left.hours} jam {left.minutes} menit lagi
            </p>
            <p className="mt-1 text-[1rem]">Satu sesi 3 menit cukup. Atau pakai pelindung kalau hari ini memang berat.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={freeze}
              disabled={freezes === 0 || pending}
              className="flex min-h-[54px] cursor-pointer items-center gap-2 rounded-[16px] border-2 border-[#9ec0f5] bg-[#eef3fd] px-[18px] font-display font-extrabold text-sky-deep shadow-[0_4px_0_#9ec0f5] transition-[transform,box-shadow] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="size-5" aria-hidden />
              Pakai pelindung ({freezes})
            </button>
            <Link
              href="/latihan/pasangan"
              className="ledge flex min-h-[54px] items-center rounded-[16px] bg-brick px-[22px] font-display font-black text-white [--ledge:var(--color-brick-deep)]"
            >
              BELAJAR 3 MENIT
            </Link>
          </div>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-[12px] bg-brick-soft px-4 py-2.5 text-[0.9375rem] font-semibold text-brick-deep">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <section
          aria-label="Streak saat ini"
          className={cn(
            "rise relative flex w-full flex-col items-center gap-1.5 overflow-hidden rounded-[28px] p-6 text-white shadow-[0_6px_0_var(--ledge)] lg:max-w-[420px] lg:flex-1",
            heroBg,
          )}
        >
          <div className="relative flex h-[240px] w-[220px] flex-col items-center justify-center">
            {!danger
              ? Array.from({ length: 10 }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="ember absolute rounded-full bg-[#ffd98a]"
                    style={
                      {
                        left: `${60 + ((i * 37) % 110)}px`,
                        bottom: "40px",
                        width: `${4 + (i % 3) * 2}px`,
                        height: `${4 + (i % 3) * 2}px`,
                        "--dx": `${(i % 2 ? 1 : -1) * (10 + i * 3)}px`,
                        animationDelay: `${-(i * 0.25).toFixed(2)}s`,
                      } as React.CSSProperties
                    }
                  />
                ))
              : null}
            <Flame
              className={cn("size-[150px]", !danger && "flick")}
              strokeWidth={1.4}
              style={{ color: flame[0], fill: flame[1] }}
              aria-hidden
            />
            <p className="absolute bottom-6 font-display text-[4.5rem] font-black leading-none text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]">
              <CountUp to={streak} />
            </p>
          </div>
          <p className="font-display text-[1.75rem] font-black">hari beruntun</p>
          <p className="text-[0.9375rem] text-[#fff3d6]">
            {streak === 0 ? "Belajar hari ini untuk memulai streak." : `Rekor terpanjangmu: ${longest} hari`}
          </p>
        </section>

        <section
          aria-labelledby="cal-t"
          className="rise min-w-0 flex-[2] rounded-[26px] border-2 border-hairline bg-surface px-[22px] py-5 shadow-[0_5px_0_var(--color-hairline)] [--i:1]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="cal-t" className="font-display text-[1.375rem] font-black capitalize">
              {monthName}
            </h2>
            <span className="flex flex-wrap gap-3 text-[0.8125rem] font-bold text-ink-subtle">
              <span className="inline-flex items-center gap-1"><span className="size-3.5 rounded-full bg-mango" />belajar</span>
              <span className="inline-flex items-center gap-1"><span className="size-3.5 rounded-full bg-[#9ec0f5]" />pelindung</span>
              <span className="inline-flex items-center gap-1"><span className="size-3.5 rounded-full border-2 border-hairline-strong" />kosong</span>
            </span>
          </div>
          <div role="grid" aria-label={`Kalender streak ${monthName}`} className="mt-3.5 grid grid-cols-7 gap-2 text-center">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
              <span key={d} className="text-[0.75rem] font-extrabold text-[#6a6f73]">
                {d}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {days.map((d) => (
              <span
                key={d.date}
                aria-label={`${d.n}, ${d.status === "frozen" ? "dilindungi" : d.status === "studied" ? "belajar" : d.future ? "belum" : d.today ? "hari ini, belum belajar" : "kosong"}`}
                className={cn(
                  "mx-auto grid size-[42px] place-items-center rounded-full border-2 text-[0.875rem] font-extrabold",
                  d.status === "studied" && "border-mango-deep bg-mango text-[#3a2400]",
                  d.status === "frozen" && "border-sky-deep bg-[#9ec0f5] text-[#0e2250]",
                  d.status === "empty" && "border-hairline-strong bg-surface text-ink-subtle",
                  d.status === "empty" && d.today && "border-brick text-brick-deep",
                  d.future && "opacity-45",
                  d.today && "pop",
                )}
              >
                {d.status === "frozen" ? <ShieldCheck className="size-4" aria-hidden /> : d.n}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <section aria-labelledby="ms-t" className="rise min-w-0 flex-[2] rounded-[26px] border-2 border-hairline bg-surface px-[22px] py-5 [--i:2]">
          <h2 id="ms-t" className="mb-3.5 font-display text-[1.25rem] font-black">
            Tonggak berikutnya
          </h2>
          <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {MILESTONES.map((m) => {
              const reached = streak >= m.n;
              const isNext = m.n === next.n && !reached;
              return (
                <li
                  key={m.n}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-[16px] border-2 px-1.5 py-3 text-center",
                    reached ? "border-mango bg-mango-soft" : isNext ? "border-primary bg-primary-soft" : "border-hairline bg-surface",
                  )}
                >
                  <span className={cn("font-display text-[1.625rem] font-black", reached ? "text-[#a86a12]" : isNext ? "text-primary-deep" : "text-ink-subtle")}>
                    {m.n}
                  </span>
                  <span className="text-[0.75rem] font-extrabold text-ink-subtle">hari</span>
                  <span className="text-[0.8125rem] font-bold text-ink-muted">{reached ? "Tercapai" : m.reward}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="set-t" className="rise flex flex-1 flex-col gap-3 rounded-[26px] border-2 border-hairline bg-surface px-[22px] py-5 [--i:3] lg:max-w-[440px]">
          <h2 id="set-t" className="font-display text-[1.25rem] font-black">
            Streak yang manusiawi
          </h2>
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-6 shrink-0 text-sky" aria-hidden />
            <span className="flex-1">
              <strong className="block">Pelindung streak · {freezes} / 2</strong>
              <span className="text-[0.875rem] text-ink-subtle">Terisi 1 tiap 7 hari belajar. Gratis.</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span id="wk-l" className="flex-1">
              <strong className="block">Akhir pekan santai</strong>
              <span className="text-[0.875rem] text-ink-subtle">Sabtu dan Minggu kosong tidak memutus streak</span>
            </span>
            <Switch checked={weekend} onChange={toggleWeekend} labelledBy="wk-l" disabled={pending} />
          </div>
        </section>
      </div>
    </div>
  );
}
