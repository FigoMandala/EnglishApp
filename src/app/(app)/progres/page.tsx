import { BookOpen, Flame, Layers, Lock, PenLine, ShieldCheck, SpellCheck, Trophy } from "lucide-react";
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

const SHADES = ["bg-hairline-soft", "bg-mango-mark", "bg-mango-line", "bg-mango"];
const WEEKS = 16;

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

  const stats: { v: number | null; l: string; ink?: string; unit?: string }[] = [
    { v: xp, l: "Total XP", ink: "text-mango-deep" },
    { v: streak, l: "Streak", unit: " hari" },
    { v: vocab.mastered, l: "Kata dikuasai" },
    { v: lessons.completed, l: "Materi selesai", unit: `/${lessons.total}` },
    { v: eprtLast, l: "Perkiraan EPrT" },
  ];

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const skills = [
    { l: "Kosakata", v: pct(vocab.mastered, vocab.total) },
    { l: "Materi grammar", v: pct(lessons.completed, lessons.total) },
    { l: "Jalur belajar", v: pct(doneUnits, units.length) },
    { l: "Writing", v: writingAvg ?? 0, empty: writingAvg === null },
  ];

  const MANGO = { bg: "bg-mango-soft", bc: "border-mango-line", ink: "text-mango-ink", chip: "bg-mango text-mango-on" };
  const GREEN = { bg: "bg-primary-soft", bc: "border-primary-line", ink: "text-primary-deep", chip: "bg-primary text-white" };
  const SKY = { bg: "bg-sky-soft", bc: "border-sky-line", ink: "text-sky-deep", chip: "bg-sky text-white" };
  const badges = [
    { name: "Streak 7", on: streak >= 7, Icon: Flame, ...MANGO },
    { name: "Materi pertama", on: lessons.completed >= 1, Icon: BookOpen, ...GREEN },
    { name: "100 Kata", on: vocab.tracked >= 100, Icon: SpellCheck, ...MANGO },
    { name: "Esai pertama", on: essays.length >= 1, Icon: PenLine, ...GREEN },
    { name: "5 Unit selesai", on: doneUnits >= 5, Icon: Layers, ...GREEN },
    { name: "Level 5", on: level.level >= 5, Icon: Trophy, ...SKY },
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

  const activeDays = weeks.flat().filter((day) => day && day.amount > 0).length;
  const avgXp = activeDays ? Math.round(weeks.flat().reduce((sum, day) => sum + (day?.amount ?? 0), 0) / activeDays) : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <header className="rise flex flex-wrap items-center gap-6 rounded-[28px] border-2 border-hairline bg-surface p-7 shadow-card">
        <span
          aria-hidden
          className="flex size-24 shrink-0 items-center justify-center rounded-full bg-mango font-display text-[2.125rem] font-black text-mango-on shadow-[inset_0_0_0_5px_#fff,0_0_0_3px_var(--color-mango-line)]"
        >
          {initials}
        </span>
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
          <h1 className="font-display text-[2rem] font-black leading-[1.1]">{user.displayName ?? user.username}</h1>
          <span className="text-[0.9375rem] text-ink-subtle">
            @{user.username} · belajar sejak {formatDate(user.createdAt)}
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-full bg-sky-soft px-2.5 py-1 text-[0.8125rem] font-extrabold text-sky-deep">
              Level {level.level}
            </span>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[0.8125rem] font-extrabold text-primary-deep">
              {levelTitle(level.level)}
            </span>
          </div>
        </div>
        <div className="flex flex-[0_1_300px] flex-col gap-2 rounded-[18px] border-2 border-hairline-soft bg-surface-muted px-4 py-3.5">
          <span className="flex justify-between gap-3 text-[0.875rem]">
            <span className="text-ink-subtle">Level berikutnya</span>
            <strong>{level.xpForNext - level.xpIntoLevel} XP lagi</strong>
          </span>
          <span className="flex justify-between gap-3 text-[0.875rem]">
            <span className="text-ink-subtle">Target harian</span>
            <strong>{DAILY_GOAL_XP} XP</strong>
          </span>
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-[0.875rem] font-extrabold">
            <Link href="/eptr#target" className="text-primary-deep hover:underline">
              Atur target EPrT
            </Link>
            {user.role === "admin" ? (
              <Link href="/admin" className="inline-flex items-center gap-1 text-ink hover:underline">
                <ShieldCheck className="size-4 text-mango-deep" aria-hidden />
                Mode Admin
              </Link>
            ) : null}
          </span>
        </div>
      </header>

      <dl className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {stats.map((s, i) => (
          <div
            key={s.l}
            className="pop-in rounded-[20px] border-2 border-hairline bg-surface px-5 py-[18px]"
            style={{ "--delay": `${i * 60}ms` } as React.CSSProperties}
          >
            <dt className="text-[0.8125rem] font-bold text-ink-subtle">{s.l}</dt>
            <dd className={cn("font-round text-[2rem] font-extrabold leading-[1.1]", s.ink)}>
              {s.v === null ? "–" : <CountUp to={s.v} ms={500} />}
              {s.unit ? <span className="text-[0.9375rem] text-ink-subtle">{s.unit}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-labelledby="heat-t"
          className="flex min-w-0 flex-[1_1_520px] flex-col gap-3.5 rounded-[24px] border-2 border-hairline bg-surface p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="heat-t" className="font-display text-[1.25rem] font-extrabold">
              Aktivitas {WEEKS} minggu
            </h2>
            <span className="text-[0.8125rem] text-ink-subtle">
              {activeDays} hari aktif · rata-rata {avgXp} XP/hari
            </span>
          </div>
          <div
            role="img"
            aria-label={`Kalender aktivitas harian ${WEEKS} minggu terakhir. Streak saat ini ${streak} hari.`}
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
          >
            {weeks.map((week, w) => (
              <div key={w} className="grid grid-rows-7 gap-1">
                {week.map((day, d) =>
                  day ? (
                    <span key={d} title={`${day.date}: ${day.amount} XP`} className={cn("h-3.5 rounded-[4px]", SHADES[day.lvl])} />
                  ) : (
                    <span key={d} className="h-3.5" />
                  ),
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-1.5 text-[0.75rem] font-extrabold text-ink-subtle">
            Sedikit
            {SHADES.map((s) => (
              <span key={s} className={cn("size-3.5 rounded-[4px]", s)} />
            ))}
            Banyak
          </div>
        </section>

        <section
          aria-labelledby="skill-t"
          className="flex min-w-[280px] flex-[0_1_380px] flex-col gap-3.5 rounded-[24px] border-2 border-hairline bg-surface p-6"
        >
          <h2 id="skill-t" className="font-display text-[1.25rem] font-extrabold">
            Kekuatan per skill
          </h2>
          <div className="flex flex-col gap-3">
            {skills.map((s, i) => (
              <div key={s.l}>
                <span className="flex justify-between text-[0.875rem] font-extrabold">
                  <span>{s.l}</span>
                  <span className={cn(!s.empty && s.v < 60 && "text-brick-deep")}>{s.empty ? "–" : `${s.v}%`}</span>
                </span>
                <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className={cn("grow-x block h-full rounded-full", s.v >= 70 ? "bg-primary" : s.v >= 60 ? "bg-mango" : "bg-brick")}
                    style={{ width: `${s.v}%`, animationDelay: `${0.2 + i * 0.08}s` }}
                  />
                </span>
              </div>
            ))}
          </div>
          <span className="text-[0.8125rem] text-ink-subtle">Di bawah 60% = perlu latihan.</span>
        </section>
      </div>

      <section aria-labelledby="badge-t" className="flex flex-col gap-3.5 rounded-[24px] border-2 border-hairline bg-surface p-6">
        <div className="flex items-baseline justify-between">
          <h2 id="badge-t" className="font-display text-[1.25rem] font-extrabold">
            Pencapaian
          </h2>
          <span className="text-[0.8125rem] text-ink-subtle">
            {unlocked} dari {badges.length}
          </span>
        </div>
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
          {badges.map((b) => (
            <li
              key={b.name}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-[18px] border-2 p-4 text-center",
                b.on ? cn(b.bg, b.bc) : "border-dashed border-hairline-strong text-ink-subtle",
              )}
            >
              <span
                className={cn(
                  "flex size-[52px] items-center justify-center rounded-[16px]",
                  b.on ? b.chip : "border-2 border-dashed border-hairline-strong",
                )}
              >
                {b.on ? <b.Icon className="size-6" aria-hidden /> : <Lock className="size-5" aria-hidden />}
              </span>
              <strong className={cn("text-[0.875rem]", !b.on && "text-ink-muted")}>{b.name}</strong>
              <span className={cn("text-[0.75rem]", b.on ? b.ink : "text-ink-subtle")}>{b.on ? "terbuka" : "terkunci"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
