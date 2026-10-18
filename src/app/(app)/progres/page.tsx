import { BookOpen, Flame, GraduationCap, Layers, Lock, PenLine, ShieldCheck, SpellCheck, Trophy, Zap } from "lucide-react";
import Link from "next/link";

import { CountUp } from "@/components/fx/count-up";
import { getEptrTrend } from "@/db/queries/activity";
import { grammarStats } from "@/db/queries/grammar";
import { learningPath, totalXp, xpByDay } from "@/db/queries/learning";
import { vocabularyStats } from "@/db/queries/vocabulary";
import { listWritingSubmissions } from "@/db/queries/writing";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { getStreakState } from "@/db/queries/streak";
import { shiftDate, todayISO } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { DAILY_GOAL_XP, levelFromXp, levelTitle } from "@/lib/xp";

export const metadata = { title: "Profil & Progres · EnglishApp" };

const SHADES = ["bg-[#f1ece2]", "bg-[#bfe0cb]", "bg-[#6db88b]", "bg-primary"];
const WEEKS = 18;

export default async function ProgresPage() {
  const user = await requireUser();
  const today = todayISO();
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = shiftDate(today, -((dow + 6) % 7));
  const rangeStart = shiftDate(monday, -(WEEKS - 1) * 7);

  const [xp, units, lessons, vocab, essays, eprt, xpMap, streakState] = await Promise.all([
    totalXp(user.id),
    learningPath(user.id),
    grammarStats(user.id),
    vocabularyStats(user.id),
    listWritingSubmissions(user.id, 50),
    getEptrTrend(user.id),
    xpByDay(user.id, rangeStart, today),
    getStreakState(user.id, today),
  ]);

  const level = levelFromXp(xp);
  const streak = streakState.streak;
  const doneUnits = units.filter((unit) => unit.state === "done").length;
  const scored = essays.filter((row) => row.total > 0);
  const writingAvg = scored.length ? Math.round(scored.reduce((sum, row) => sum + row.total, 0) / scored.length) : null;
  const eprtLast = eprt.length > 0 ? eprt[eprt.length - 1].total : null;
  const initials = (user.displayName ?? user.username).slice(0, 2).toUpperCase();

  const stats = [
    { v: streak, l: "hari streak", Icon: Flame, bg: "bg-mango-soft", ink: "text-[#a86a12]" },
    { v: xp, l: "total XP", Icon: Zap, bg: "bg-primary-soft", ink: "text-primary-deep" },
    { v: vocab.mastered, l: "kata dikuasai", Icon: SpellCheck, bg: "bg-[#f1e8f7]", ink: "text-[#5d2e86]" },
    { v: eprtLast, l: "estimasi EPrT", Icon: GraduationCap, bg: "bg-sky-soft", ink: "text-sky-deep" },
  ];

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const skills = [
    { l: "Kosakata", v: pct(vocab.mastered, vocab.total), c: "bg-mango" },
    { l: "Materi grammar", v: pct(lessons.completed, lessons.total), c: "bg-primary" },
    { l: "Jalur belajar", v: pct(doneUnits, units.length), c: "bg-sky" },
    { l: "Writing", v: writingAvg ?? 0, c: "bg-[#d9583b]", empty: writingAvg === null },
  ];

  const badges = [
    { name: "Streak 7", on: streak >= 7, Icon: Flame, bg: "bg-mango-soft", bc: "border-mango", ink: "text-[#a86a12]" },
    { name: "Materi pertama", on: lessons.completed >= 1, Icon: BookOpen, bg: "bg-primary-soft", bc: "border-primary", ink: "text-primary-deep" },
    { name: "100 Kata", on: vocab.tracked >= 100, Icon: SpellCheck, bg: "bg-[#f1e8f7]", bc: "border-[#8c5bb5]", ink: "text-[#5d2e86]" },
    { name: "Esai pertama", on: essays.length >= 1, Icon: PenLine, bg: "bg-sky-soft", bc: "border-sky", ink: "text-sky-deep" },
    { name: "5 Unit selesai", on: doneUnits >= 5, Icon: Layers, bg: "bg-primary-soft", bc: "border-primary", ink: "text-primary-deep" },
    { name: "Level 5", on: level.level >= 5, Icon: Trophy, bg: "bg-mango-soft", bc: "border-mango", ink: "text-[#a86a12]" },
  ];
  const unlocked = badges.filter((b) => b.on).length;

  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = shiftDate(monday, (w - (WEEKS - 1)) * 7 + d);
      if (date > today) return null;
      const amount = xpMap.get(date) ?? 0;
      const lvl = amount <= 0 ? 0 : amount >= DAILY_GOAL_XP ? 3 : amount >= DAILY_GOAL_XP / 2 ? 2 : 1;
      return { date, amount, lvl };
    }),
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="rise flex flex-wrap items-center gap-6 rounded-[26px] border-2 border-hairline bg-surface px-7 py-6 shadow-[0_5px_0_var(--color-hairline)]">
        <div className="relative size-[140px] shrink-0">
          <span className="absolute inset-3.5 grid place-items-center rounded-full bg-mango font-display text-[2.625rem] font-black text-[#3a2400]">
            {initials}
          </span>
          <span className="pop absolute bottom-1 right-[-4px] rounded-full border-[3px] border-white bg-primary px-2.5 py-1 font-display text-[0.9375rem] font-black text-white [animation-delay:800ms]">
            Lv {level.level}
          </span>
        </div>
        <div className="min-w-[260px] flex-1">
          <h1 className="font-display text-[2.25rem] font-black tracking-[-0.02em]">{user.displayName ?? user.username}</h1>
          <p className="mt-1 text-[1rem] text-ink-subtle">
            @{user.username} · belajar sejak {formatDate(user.createdAt)}
          </p>
          <p className="mt-2.5 text-[0.9375rem] font-bold text-primary-deep">
            {level.xpForNext - level.xpIntoLevel} XP lagi menuju Level {level.level + 1} · {levelTitle(level.level + 1)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/eptr"
            className="flex min-h-12 items-center gap-2 rounded-[14px] border-2 border-hairline bg-surface px-4 font-extrabold shadow-[0_3px_0_var(--color-hairline)] transition-[transform,box-shadow] active:translate-y-[3px] active:shadow-none"
          >
            Atur target
          </Link>
          {user.role === "admin" ? (
            <Link
              href="/admin"
              className="flex min-h-12 items-center gap-2.5 rounded-[14px] bg-charcoal px-4 font-extrabold text-white shadow-[0_3px_0_#000] transition-[transform,box-shadow] active:translate-y-[3px] active:shadow-none"
            >
              <ShieldCheck className="size-4 text-mango" aria-hidden />
              Mode Admin
            </Link>
          ) : null}
        </div>
      </section>

      <section aria-label="Statistik" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.l}
            className="pop flex items-center gap-3.5 rounded-[20px] border-2 border-hairline bg-surface p-[18px] shadow-[0_4px_0_var(--color-hairline)]"
            style={{ "--i": i + 1 } as React.CSSProperties}
          >
            <span className={cn("grid size-12 shrink-0 place-items-center rounded-[14px]", s.bg, s.ink)}>
              <s.Icon className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-display text-[1.75rem] font-black leading-none">
                {s.v === null ? "–" : <CountUp to={s.v} />}
              </span>
              <span className="text-[0.875rem] font-bold text-ink-subtle">{s.l}</span>
            </span>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <section
          aria-labelledby="heat-t"
          className="rise min-w-0 flex-1 rounded-[24px] border-2 border-hairline bg-surface p-[22px] shadow-[0_4px_0_var(--color-hairline)] [--i:2]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="heat-t" className="font-display text-[1.25rem] font-black">
              Aktivitas {WEEKS} minggu terakhir
            </h2>
            <span className="flex items-center gap-1.5 text-[0.8125rem] font-bold text-ink-subtle">
              Sedikit
              {SHADES.map((s) => (
                <span key={s} className={cn("size-3.5 rounded-[4px]", s)} />
              ))}
              Banyak
            </span>
          </div>
          <div
            role="img"
            aria-label={`Kalender aktivitas harian ${WEEKS} minggu terakhir. Streak saat ini ${streak} hari.`}
            className="mt-4 grid gap-[5px]"
            style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
          >
            {weeks.map((week, w) => (
              <div key={w} className="grid grid-rows-7 gap-[5px]">
                {week.map((day, d) =>
                  day ? (
                    <span
                      key={d}
                      title={`${day.date}: ${day.amount} XP`}
                      className={cn("pop aspect-square rounded-[5px]", SHADES[day.lvl])}
                      style={{ animationDelay: `${w * 0.025}s` }}
                    />
                  ) : (
                    <span key={d} className="aspect-square" />
                  ),
                )}
              </div>
            ))}
          </div>

          <h2 className="mt-7 font-display text-[1.25rem] font-black">Kekuatan per skill</h2>
          <ul className="mt-3.5 flex flex-col gap-3">
            {skills.map((s, i) => (
              <li key={s.l} className="grid grid-cols-[110px_1fr_52px] items-center gap-3 sm:grid-cols-[140px_1fr_60px]">
                <span className="text-[0.9375rem] font-extrabold">{s.l}</span>
                <span className="h-4 overflow-hidden rounded-full bg-[#f1ece2]">
                  <span
                    className={cn("grow-x block h-full rounded-full", s.c)}
                    style={{ width: `${s.v}%`, animationDelay: `${0.3 + i * 0.1}s` }}
                  />
                </span>
                <span className="text-right font-display text-[1rem] font-black">{s.empty ? "–" : `${s.v}%`}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="badge-t"
          className="rise w-full rounded-[24px] border-2 border-hairline bg-surface p-[22px] shadow-[0_4px_0_var(--color-hairline)] [--i:3] lg:w-[380px] lg:shrink-0"
        >
          <h2 id="badge-t" className="font-display text-[1.25rem] font-black">
            Lencana
          </h2>
          <p className="mt-0.5 text-[0.875rem] text-ink-subtle">
            {unlocked} dari {badges.length} terbuka
          </p>
          <ul className="mt-3.5 grid grid-cols-3 gap-3">
            {badges.map((b) => (
              <li key={b.name} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    "grid size-[76px] place-items-center rounded-[22px] border-[3px] shadow-[0_4px_0_var(--color-hairline-strong)]",
                    b.on ? cn(b.bg, b.bc, b.ink) : "border-hairline-strong bg-[#f1ece2] text-[#8f8574]",
                  )}
                >
                  {b.on ? <b.Icon className="size-8" aria-hidden /> : <Lock className="size-7" aria-hidden />}
                </span>
                <span className={cn("text-[0.8125rem] font-extrabold", b.on ? "text-ink" : "text-ink-subtle")}>{b.name}</span>
                <span className="sr-only">{b.on ? "terbuka" : "terkunci"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
