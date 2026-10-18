import { BookOpen, Flame, Play, Trophy, Zap } from "lucide-react";
import Link from "next/link";

import { GaugeRing } from "@/components/charts";
import { CountUp } from "@/components/fx/count-up";
import { Card } from "@/components/ui/card";
import { grammarStats } from "@/db/queries/grammar";
import { learningPath, totalXp, xpByDay } from "@/db/queries/learning";
import { listDueCards, vocabularyStats } from "@/db/queries/vocabulary";
import { listWritingSubmissions } from "@/db/queries/writing";
import { relativeDay, todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { getStreakState } from "@/db/queries/streak";
import { shiftDate } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { DAILY_GOAL_KEY } from "@/db/queries/onboarding";
import { getSetting } from "@/db/queries/activity";
import { DAILY_GOAL_XP as DEFAULT_GOAL_XP, levelFromXp, levelTitle } from "@/lib/xp";

import { UnitMap } from "./unit-map";

export const metadata = { title: "Jalur Belajar · EnglishApp" };

export default async function BelajarPage() {
  const user = await requireUser();
  const today = todayISO();

  const [units, xp, lessonStats, vocabStats, dueCards, submissions, xpByDate, streakState, DAILY_GOAL_XP] = await Promise.all([
    learningPath(user.id),
    totalXp(user.id),
    grammarStats(user.id),
    vocabularyStats(user.id),
    listDueCards(user.id, 20),
    listWritingSubmissions(user.id, 1),
    // 60 hari ke belakang supaya perhitungan streak akurat.
    xpByDay(user.id, shiftDate(today, -59), today),
    getStreakState(user.id, today),
    getSetting<number>(user.id, DAILY_GOAL_KEY, DEFAULT_GOAL_XP),
  ]);
  const reviewCount = vocabStats.due;

  const level = levelFromXp(xp);
  const streak = streakState.streak;

  const currentUnit = units.find((unit) => unit.state === "current") ?? null;
  const todayXp = xpByDate.get(today) ?? 0;
  const latestEssay = submissions[0] ?? null;

  const dueText =
    reviewCount > 0
      ? `${reviewCount} kartu siap diulang`
      : dueCards.length > 0
        ? `${dueCards.length} kata baru menantimu`
        : "Ulangi kata dengan flashcard";

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <section aria-label="Jalur unit" className="flex min-w-0 flex-1 flex-col items-center gap-3">
        {units.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 p-6">
            <p className="font-display text-[1.25rem] font-extrabold">Jalur belajar belum diisi</p>
            <p className="text-[0.9375rem] text-ink-subtle">
              Jalankan <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">npm run db:seed</code>{" "}
              untuk mengisi 10 unit pertama beserta materi dan kosakatanya.
            </p>
          </Card>
        ) : (
          <>
            {currentUnit ? (
              <div className="rise relative flex w-full max-w-[680px] items-center justify-between gap-4 overflow-hidden rounded-[22px] bg-primary px-6 py-5 text-white shadow-[0_5px_0_var(--color-primary-deep)]">
                <div className="relative">
                  <p className="text-[0.875rem] font-extrabold tracking-[0.08em] text-[#cfebda]">
                    UNIT {units.indexOf(currentUnit) + 1} DARI {units.length}
                  </p>
                  <h1 className="mt-1 font-display text-[1.875rem] font-black tracking-[-0.02em]">{currentUnit.title}</h1>
                  <p className="mt-1 text-[1rem] text-primary-soft">{currentUnit.description}</p>
                </div>
                <Link
                  href={`/belajar/${currentUnit.slug}`}
                  className="ledge relative flex h-[52px] shrink-0 items-center rounded-[14px] border-2 border-[#5db386] bg-primary-bright px-[18px] font-display text-[1rem] font-extrabold text-white"
                >
                  BUKA UNIT
                </Link>
              </div>
            ) : (
              <h1 className="font-display text-[1.875rem] font-black">Jalur Belajar</h1>
            )}
            <UnitMap units={units} />
          </>
        )}
      </section>

      <aside aria-label="Ringkasan harian" className="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
        <div className="rise flex justify-between gap-2 px-1 py-1.5 font-display text-[1.25rem] font-black">
          <Link href="/streak" className="inline-flex items-center gap-1.5 text-[#a86a12]" title="Streak">
            <Flame className={cn("size-6", streak > 0 && "flick")} aria-hidden />
            <CountUp to={streak} />
            <span className="sr-only">hari streak</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 text-primary-deep" title="XP total">
            <Zap className="size-6" aria-hidden />
            <CountUp to={xp} />
            <span className="sr-only">XP total</span>
          </span>
          <Link href="/progres" className="inline-flex items-center gap-1.5 text-sky-deep" title="Level">
            <Trophy className="size-6" aria-hidden />
            {level.level}
            <span className="sr-only">level {levelTitle(level.level)}</span>
          </Link>
        </div>

        <Card className="rise flex items-center gap-[18px] p-5 [--i:1]">
          <GaugeRing
            value={Math.round((todayXp / DAILY_GOAL_XP) * 100)}
            label="Target harian"
            caption={`${todayXp}/${DAILY_GOAL_XP} XP`}
            size={96}
          />
          <div>
            <p className="font-display text-[1.25rem] font-black">Target harian</p>
            <p className="mt-1 text-[0.9375rem] text-ink-subtle">
              {todayXp >= DAILY_GOAL_XP
                ? "Target tercapai, keren!"
                : `${DAILY_GOAL_XP - todayXp} XP lagi. Satu pelajaran pendek cukup.`}
            </p>
          </div>
        </Card>

        <Card className="rise p-5 [--i:2]">
          <h2 className="font-display text-[1.25rem] font-black">
            Level {level.level} · {levelTitle(level.level)}
          </h2>
          <div className="mt-3 h-3.5 overflow-hidden rounded-full bg-surface-sunken/60">
            <div className="grow-x h-full rounded-full bg-primary" style={{ width: `${level.progress}%` }} />
          </div>
          <p className="mt-2 text-[0.875rem] text-ink-subtle">
            {level.xpIntoLevel}/{level.xpForNext} XP ke level {level.level + 1}
          </p>
        </Card>

        <Link
          href="/kosakata"
          className="rise ledge flex items-center gap-3.5 rounded-[22px] border-2 border-[#f2c878] bg-mango-soft px-5 py-[18px] text-mango-ink [--i:3] [--ledge:#f2c878]"
        >
          <span className="grid size-[54px] shrink-0 place-items-center rounded-[10px] border-2 border-[#f2c878] bg-white font-display text-[1.125rem] font-black">
            Aa
          </span>
          <span className="flex-1">
            <strong className="block font-display text-[1.125rem]">{dueText}</strong>
            <span className="text-[0.875rem]">Kosakata (SRS)</span>
          </span>
        </Link>

        <Link
          href="/eptr"
          className="rise ledge flex items-center gap-3.5 rounded-[22px] bg-[#2a2c33] px-[18px] py-4 text-canvas [--i:4] [--ledge:#15161a]"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-[16px] bg-[#3a3d46] text-mango">
            <Play className="size-6" aria-hidden />
          </span>
          <span className="flex-1">
            <strong className="block font-display text-[1.125rem]">Tes EPrT</strong>
            <span className="text-[0.875rem] text-[#d3ccbe]">Simulasi dan latihan soal</span>
          </span>
        </Link>

        <Card className="rise flex items-center gap-3 p-4 [--i:5]">
          <BookOpen className="size-5 text-primary" aria-hidden />
          <span className="flex-1 text-[0.9375rem]">
            <strong className="block">Materi grammar</strong>
            <span className="text-ink-subtle">
              {lessonStats.completed}/{lessonStats.total} selesai
            </span>
          </span>
          <Link href="/materi" className="font-bold text-primary">
            Buka
          </Link>
        </Card>
        {latestEssay ? (
          <p className="px-1 text-[0.8125rem] text-ink-subtle">
            Esai terakhir: skor {latestEssay.total} ({relativeDay(latestEssay.createdAt)})
          </p>
        ) : null}
      </aside>
    </div>
  );
}
