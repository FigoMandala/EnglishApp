"use client";

import { Flame, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Confetti } from "@/components/fx/confetti";
import { CountUp } from "@/components/fx/count-up";
import { Switch } from "@/components/ui/switch";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

import { setWeekendEasyAction, spendFreezeAction } from "./actions";

type Day = { n: number; date: string; status: "studied" | "frozen" | "empty"; future: boolean; today: boolean };

const MILESTONES = [
  { n: 7, reward: "Lencana Streak 7", short: "Seminggu" },
  { n: 14, reward: "Dua minggu penuh", short: "2 minggu" },
  { n: 30, reward: "Sebulan konsisten", short: "Sebulan" },
  { n: 60, reward: "Kebiasaan terbentuk", short: "Kebiasaan" },
  { n: 100, reward: "Seratus hari", short: "Seratus" },
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
  const [celebrate, setCelebrate] = useState(0);

  const danger = streak > 0 && !studiedToday && !frozenToday;
  const next = MILESTONES.find((m) => m.n > streak) ?? MILESTONES[MILESTONES.length - 1];

  function freeze() {
    setError(null);
    startTransition(async () => {
      const result = await spendFreezeAction();
      if (!result.ok) setError(result.message ?? "Gagal memakai pelindung.");
      else {
        sfx.correct();
        setCelebrate((n) => n + 1);
      }
    });
  }

  function toggleWeekend(on: boolean) {
    setWeekend(on);
    setError(null);
    startTransition(async () => {
      try {
        await setWeekendEasyAction(on);
      } catch {
        // Batalkan optimisme supaya saklar sesuai keadaan server.
        setWeekend(!on);
        setError("Gagal mengubah mode akhir pekan. Coba lagi.");
      }
    });
  }

  const safe = studiedToday || frozenToday;

  // Ringkasan kalender untuk pembaca layar: satu label memakai angka nyata dari data hari.
  const studiedCount = days.filter((d) => d.status === "studied").length;
  const frozenCount = days.filter((d) => d.status === "frozen").length;
  const emptyCount = days.filter((d) => d.status === "empty" && !d.future).length;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <section
        aria-label="Streak saat ini"
        className="rise relative flex flex-wrap items-center gap-8 rounded-[32px] border-2 border-mango-line bg-mango-soft p-6 text-mango-ink shadow-[0_5px_0_var(--color-mango-line)] sm:p-8"
      >
        {celebrate > 0 ? <Confetti key={celebrate} /> : null}
        <div className="flex items-center gap-5">
          <Flame
            className={cn("size-[120px] shrink-0", streak > 0 && "flick")}
            strokeWidth={1.4}
            style={{ color: "var(--color-mango-deep)", fill: "var(--color-mango)" }}
            aria-hidden
          />
          <div className="flex flex-col">
            <CountUp to={streak} className="font-round text-[6rem] font-extrabold leading-[0.85] text-ink" />
            <span className="font-display text-[1.375rem] font-extrabold text-ink">hari beruntun</span>
            <span className="text-[0.875rem] font-bold">
              {streak === 0 ? "Belajar hari ini untuk memulai streak." : `Rekor terpanjangmu: ${longest} hari`}
            </span>
          </div>
        </div>

        <div
          aria-live="polite"
          className="flex flex-[1_1_320px] flex-col gap-3 rounded-[22px] border-2 border-mango-line bg-surface p-5 text-ink"
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "size-3 rounded-full",
                safe ? "bg-primary shadow-[0_0_0_4px_var(--color-primary-soft)]" : "bg-brick shadow-[0_0_0_4px_var(--color-brick-soft)]",
              )}
              aria-hidden
            />
            <strong className="font-display text-[1.1875rem]">
              {studiedToday ? "Hari ini sudah aman" : frozenToday ? "Hari ini dilindungi" : "Hari ini belum aman"}
            </strong>
          </div>
          <p className="text-[0.9375rem] text-ink-muted">
            {studiedToday
              ? "Kamu sudah belajar hari ini. Sampai besok!"
              : frozenToday
                ? "Pelindung dipakai. Streak tetap jalan walau hari ini kosong."
                : danger
                  ? `Sisa ${left.hours} jam ${left.minutes} menit. Satu sesi 3 menit cukup, atau pakai pelindung kalau hari ini memang berat.`
                  : "Satu sesi 3 menit cukup untuk memulai streak."}
          </p>
          {!safe ? (
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/latihan/pasangan"
                className="flex h-[50px] items-center rounded-[14px] bg-primary px-5 font-display text-[0.9375rem] font-extrabold text-white shadow-[0_4px_0_var(--color-primary-deep)] transition-transform active:translate-y-1 active:shadow-none"
              >
                Sesi 3 menit
              </Link>
              {danger ? (
                freezes === 0 ? (
                  // Progres pengisian pelindung berikutnya tidak tersedia di client, jadi arahan tanpa angka.
                  <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-sky-deep">
                    <ShieldCheck className="size-[18px]" aria-hidden />
                    Pelindung habis — belajar lagi untuk dapat 1 baru.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={freeze}
                    disabled={pending}
                    className="flex h-[50px] cursor-pointer items-center gap-2 rounded-[14px] border-2 border-sky-line bg-sky-soft px-[18px] font-display text-[0.9375rem] font-extrabold text-sky-deep shadow-[0_4px_0_var(--color-sky-line)] transition-transform active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShieldCheck className="size-[18px]" aria-hidden />
                    Pakai pelindung (sisa {freezes})
                  </button>
                )
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-[12px] bg-brick-soft px-3.5 py-2 text-[0.875rem] font-semibold text-brick-deep">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-labelledby="cal-t"
          className="flex min-w-0 flex-[1_1_520px] flex-col gap-4 rounded-[24px] border-2 border-hairline bg-surface p-6"
        >
          <h2 id="cal-t" className="text-center font-display text-[1.25rem] font-extrabold capitalize">
            {monthName}
          </h2>
          <div aria-hidden className="grid grid-cols-7 gap-2 text-center text-[0.75rem] font-extrabold text-ink-subtle">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div
            role="img"
            aria-label={`Kalender streak ${monthName}: ${studiedCount} hari belajar, ${frozenCount} dilindungi, ${emptyCount} kosong`}
            className="grid grid-cols-7 gap-2"
          >
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {days.map((d) => (
              <span
                key={d.date}
                aria-hidden
                className={cn(
                  "flex aspect-square items-center justify-center rounded-[14px] font-round text-[1.0625rem] font-extrabold",
                  d.status === "studied" && "bg-mango text-mango-on",
                  d.status === "frozen" && "border-2 border-sky-line bg-sky-soft text-sky-deep",
                  d.status === "empty" && !d.future && "border-2 border-dashed border-hairline-strong text-ink-subtle",
                  d.future && "bg-surface-muted text-ink-faint",
                  d.today && "border-[3px] border-solid border-brick",
                )}
              >
                {d.status === "frozen" ? <ShieldCheck className="size-[18px]" aria-hidden /> : d.n}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-[0.8125rem] font-extrabold text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-[4px] bg-mango" />
              belajar
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-[4px] border-2 border-sky-line bg-sky-soft" />
              pelindung
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-[4px] border-2 border-dashed border-hairline-strong" />
              kosong
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded-[4px] border-[3px] border-brick" />
              hari ini
            </span>
          </div>
        </section>

        <aside className="flex min-w-[280px] flex-[0_1_340px] flex-col gap-4">
          <div className="flex items-center gap-3 rounded-[24px] border-2 border-hairline bg-surface p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-sky-soft text-sky">
              <ShieldCheck className="size-6" aria-hidden />
            </span>
            <span>
              <strong className="block font-display text-[1.125rem]">{freezes} pelindung</strong>
              <span className="text-[0.8125rem] text-ink-subtle">Maks 2 · terisi 1 tiap 7 hari belajar. Gratis.</span>
            </span>
          </div>

          <div className="flex items-center gap-3.5 rounded-[24px] border-2 border-hairline bg-surface px-5 py-[18px]">
            <span id="wk-l" className="flex-1">
              <strong className="block text-[0.9375rem]">Akhir pekan santai</strong>
              <span className="text-[0.8125rem] text-ink-subtle">Sabtu dan Minggu kosong tidak memutus streak</span>
            </span>
            <Switch checked={weekend} onChange={toggleWeekend} labelledBy="wk-l" disabled={pending} />
          </div>

          <div className="flex flex-col gap-3 rounded-[24px] border-2 border-hairline bg-surface p-5">
            <span className="eyebrow text-ink-subtle">Lencana streak</span>
            <ol className="grid grid-cols-5 gap-2 text-center">
              {MILESTONES.map((m) => {
                const reached = streak >= m.n;
                const isNext = m.n === next.n && !reached;
                return (
                  <li
                    key={m.n}
                    title={m.reward}
                    className={cn(
                      "flex flex-col items-center gap-1 text-[0.6875rem] font-extrabold",
                      isNext ? "text-mango-ink" : !reached && "text-ink-subtle",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-[14px] font-round",
                        m.n >= 100 ? "text-base" : "text-[1.125rem]",
                        reached
                          ? "bg-mango text-mango-on"
                          : isNext
                            ? "border-[3px] border-mango bg-mango-soft"
                            : "border-2 border-dashed border-hairline-strong",
                      )}
                    >
                      {m.n}
                    </span>
                    {reached ? "Tercapai" : isNext ? `${streak}/${m.n}` : m.short}
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
