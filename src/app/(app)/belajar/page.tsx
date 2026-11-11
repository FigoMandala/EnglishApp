import { ArrowRight, Check, ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";

import { GaugeRing } from "@/components/charts";
import { Kaka } from "@/components/mascot";
import { Card } from "@/components/ui/card";
import { getEptrTarget, getSetting } from "@/db/queries/activity";
import { listGrammarLessons } from "@/db/queries/grammar";
import { leagueBoard } from "@/db/queries/league";
import { learningPath, totalXp, xpByDay } from "@/db/queries/learning";
import { DAILY_GOAL_KEY } from "@/db/queries/onboarding";
import { getStreakState } from "@/db/queries/streak";
import { listDueCards, vocabularyStats } from "@/db/queries/vocabulary";
import { listWritingSubmissions } from "@/db/queries/writing";
import { daysBetween, relativeDay, todayISO } from "@/lib/dates";
import { LEAGUE_TIERS, weekBounds } from "@/lib/league";
import { requireUser } from "@/lib/session";
import { shiftDate } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { DAILY_GOAL_XP as DEFAULT_GOAL_XP, levelFromXp, levelTitle, XP_REWARDS } from "@/lib/xp";

import { UnitMap, type UnitView } from "./unit-map";

export const metadata = { title: "Jalur Belajar · EnglishApp" };

const SECTIONS = [
  { level: "basic", label: "Dasar" },
  { level: "intermediate", label: "Menengah" },
  { level: "advanced", label: "Lanjut" },
] as const;

const DAY_LETTERS = ["S", "S", "R", "K", "J", "S", "M"];

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()),
  );
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export default async function BelajarPage() {
  const user = await requireUser();
  const today = todayISO();

  const [units, xp, lessons, vocabStats, dueCards, submissions, xpByDate, streakState, goalXp, target, league] =
    await Promise.all([
      learningPath(user.id),
      totalXp(user.id),
      listGrammarLessons(user.id),
      vocabularyStats(user.id),
      listDueCards(user.id, 20),
      listWritingSubmissions(user.id, 1),
      xpByDay(user.id, shiftDate(today, -13), today),
      getStreakState(user.id, today),
      getSetting<number>(user.id, DAILY_GOAL_KEY, DEFAULT_GOAL_XP),
      getEptrTarget(user.id),
      leagueBoard(user.id, today),
    ]);

  const level = levelFromXp(xp);
  const todayXp = xpByDate.get(today) ?? 0;
  const left = Math.max(0, goalXp - todayXp);
  const latestEssay = submissions[0] ?? null;
  const doneSlugs = new Set(lessons.filter((lesson) => lesson.completed).map((lesson) => lesson.slug));

  const currentIndex = units.findIndex((unit) => unit.state === "current");
  const currentUnit = currentIndex >= 0 ? units[currentIndex] : null;

  // Langkah unit berjalan: semua sebelum materi pertama yang belum selesai dianggap beres.
  const steps = currentUnit
    ? (() => {
        const firstOpen = currentUnit.items.findIndex(
          (item) => item.kind === "grammar" && !(item.refSlug && doneSlugs.has(item.refSlug)),
        );
        return currentUnit.items.map((item, i) => ({
          ...item,
          state: firstOpen === -1 || i < firstOpen ? "done" : i === firstOpen ? "current" : "todo",
        }));
      })()
    : [];
  const nextStep = steps.find((step) => step.state === "current");
  const nextHref = nextStep?.kind === "grammar" && nextStep.refSlug ? `/materi/${nextStep.refSlug}` : currentUnit ? `/belajar/${currentUnit.slug}` : "/belajar";

  const dueText =
    vocabStats.due > 0
      ? `${vocabStats.due} kartu siap diulang`
      : dueCards.length > 0
        ? `${dueCards.length} kata baru menunggu`
        : "Ulangi kata dengan flashcard";

  // Minggu ini (Senin–Minggu) untuk strip streak.
  const week = weekBounds(today);
  const weekDays = DAY_LETTERS.map((letter, i) => {
    const date = shiftDate(week.start, i);
    const studied = (xpByDate.get(date) ?? 0) > 0;
    const frozen = streakState.frozen.includes(date);
    const status = studied ? "studied" : frozen ? "frozen" : date === today ? "today" : date > today ? "future" : "empty";
    return { letter, date, status, isToday: date === today };
  });

  const views: UnitView[] = units.map((unit, i) => ({
    id: unit.id,
    order: i + 1,
    slug: unit.slug,
    title: unit.title.replace(/^Unit \d+:\s*/, ""),
    description: unit.description,
    level: unit.level,
    state: unit.state,
    remaining: unit.state === "current" ? steps.filter((step) => step.state !== "done").length : 0,
  }));

  const daysToTest = target?.testDate ? Math.max(0, daysBetween(today, target.testDate)) : null;
  const tier = LEAGUE_TIERS[league.tier];

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <section
        aria-label="Jalur unit"
        className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-clip"
      >
        <div className="rise flex flex-col gap-1">
          <p className="text-[0.9375rem] font-bold text-ink-subtle">
            {greeting()}, {user.displayName ?? user.username}
          </p>
          <h1 className="font-display text-[1.875rem] font-black leading-[1.15] tracking-[-0.02em] sm:text-[2.125rem]">
            {left > 0 ? `${left} XP lagi untuk target hari ini` : "Target hari ini tercapai, keren!"}
          </h1>
        </div>

        {units.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 p-6">
            <p className="font-display text-[1.25rem] font-extrabold">Jalur belajar belum diisi</p>
            <p className="text-[0.9375rem] text-ink-subtle">
              Jalankan <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">npm run db:seed</code>{" "}
              untuk mengisi unit pertama beserta materi dan kosakatanya.
            </p>
          </Card>
        ) : null}

        {currentUnit ? (
          <div className="rise relative flex flex-col gap-5 overflow-hidden rounded-hero bg-primary p-6 text-white shadow-[0_6px_0_var(--color-primary-deep)] [--i:1] sm:p-7">
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
                <span className="text-[0.75rem] font-extrabold tracking-[0.08em] text-[#cfebda]">
                  UNIT {currentIndex + 1} DARI {units.length} ·{" "}
                  {SECTIONS.find((s) => s.level === currentUnit.level)?.label.toUpperCase()}
                </span>
                <h2 className="font-display text-[1.75rem] font-black leading-[1.15] tracking-[-0.02em] sm:text-[1.875rem]">
                  {currentUnit.title.replace(/^Unit \d+:\s*/, "")}
                </h2>
                {currentUnit.description ? <p className="text-primary-soft">{currentUnit.description}</p> : null}
              </div>
              <Link
                href={nextHref}
                className="flex h-[54px] shrink-0 items-center gap-2 rounded-[16px] bg-white px-[22px] font-display text-[1rem] font-extrabold tracking-[0.03em] text-primary-deep shadow-[0_5px_0_var(--color-primary-deep)] transition-transform active:translate-y-[5px] active:shadow-none"
              >
                LANJUTKAN
                <ArrowRight className="size-[18px]" strokeWidth={2.8} aria-hidden />
              </Link>
            </div>
            {steps.length ? (
              <ol className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                {steps.map((step, i) => {
                  const href = step.kind === "grammar" && step.refSlug ? `/materi/${step.refSlug}` : `/kosakata?level=${currentUnit.level}`;
                  return (
                    <li key={step.id}>
                      <Link
                        href={href}
                        className={cn(
                          "flex h-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[0.875rem] font-bold leading-tight",
                          step.state === "done" && "bg-primary-deep",
                          step.state === "current" && "bg-white font-extrabold text-primary-deep",
                          step.state === "todo" && "border-2 border-dashed border-[#5db386] text-[#cfebda]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-[26px] shrink-0 items-center justify-center rounded-full font-round text-[0.875rem] font-extrabold",
                            step.state === "done" && "bg-mint text-primary-deep",
                            step.state === "current" && "bg-primary text-white",
                            step.state === "todo" && "border-2 border-[#5db386]",
                          )}
                        >
                          {step.state === "done" ? <Check className="size-3.5" strokeWidth={3.4} aria-hidden /> : i + 1}
                        </span>
                        {step.title}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        ) : null}

        {SECTIONS.map((section, sectionIndex) => {
          const sectionUnits = views.filter((unit) => unit.level === section.level);
          if (!sectionUnits.length) return null;
          const allDone = sectionUnits.every((unit) => unit.state === "done");
          if (allDone) {
            return (
              <details key={section.level} className="group rounded-plate border-2 border-hairline bg-surface">
                <summary className="flex cursor-pointer list-none items-center gap-3.5 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden className="flex gap-1">
                    {sectionUnits.slice(0, 5).map((unit) => (
                      <span key={unit.id} className="size-[22px] rounded-full bg-primary" />
                    ))}
                  </span>
                  <span className="flex-1">
                    <strong className="block font-display text-[1.0625rem]">
                      Bagian {sectionIndex + 1} · {section.label}
                    </strong>
                    <span className="text-[0.875rem] text-ink-subtle">
                      {sectionUnits.length} unit selesai · bisa diulang kapan saja
                    </span>
                  </span>
                  <span className="text-[0.875rem] font-extrabold text-primary-deep group-open:hidden">Lihat</span>
                  <span className="hidden text-[0.875rem] font-extrabold text-primary-deep group-open:inline">Tutup</span>
                </summary>
                <div className="border-t-2 border-hairline-soft px-2 pb-6">
                  <UnitMap units={sectionUnits} />
                </div>
              </details>
            );
          }
          return (
            <div key={section.level} className="flex flex-col gap-2">
              <div className="flex items-center gap-3.5">
                <span className="h-0.5 flex-1 bg-hairline" />
                <span className="eyebrow text-ink-subtle">
                  Bagian {sectionIndex + 1} · {section.label}
                </span>
                <span className="h-0.5 flex-1 bg-hairline" />
              </div>
              <UnitMap units={sectionUnits} />
            </div>
          );
        })}
      </section>

      <aside aria-label="Ringkasan harian" className="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
        <Card className="rise flex flex-col gap-4 p-5 [--i:1]">
          <div className="flex items-center gap-4">
            <GaugeRing
              value={goalXp > 0 ? (todayXp / goalXp) * 100 : 0}
              display={String(todayXp)}
              caption={`/ ${goalXp} XP`}
              label={`Target harian ${todayXp} dari ${goalXp} XP`}
              size={92}
            />
            <div>
              <p className="font-display text-[1.25rem] font-black">Target harian</p>
              <p className="mt-0.5 text-[0.875rem] text-ink-subtle">
                {left > 0 ? `${left} XP lagi. Satu pelajaran pendek cukup.` : "Tercapai. Sisanya bonus!"}
              </p>
            </div>
          </div>
          <ol aria-label="Minggu ini" className="grid grid-cols-7 gap-1.5 text-center">
            {weekDays.map((day) => (
              <li
                key={day.date}
                className={cn("flex flex-col items-center gap-1 text-[0.75rem] font-extrabold", day.isToday ? "text-ink" : "text-ink-subtle")}
              >
                {day.letter}
                <span
                  aria-label={`${day.date}: ${
                    { studied: "belajar", frozen: "dilindungi", today: "hari ini, belum belajar", future: "belum", empty: "kosong" }[day.status]
                  }`}
                  className={cn(
                    "block size-7 rounded-full",
                    day.status === "studied" && "bg-mango",
                    day.status === "frozen" && "border-2 border-sky-line bg-sky-soft",
                    day.status === "today" && "border-[3px] border-mango bg-mango-soft",
                    (day.status === "future" || day.status === "empty") && "border-2 border-dashed border-hairline-strong",
                  )}
                />
              </li>
            ))}
          </ol>
          <p className="text-[0.8125rem] text-ink-subtle">
            Streak {streakState.streak} hari · {streakState.studiedToday ? "hari ini aman" : "hari ini belum aman"}
          </p>
        </Card>

        <Card className="rise flex flex-col gap-2.5 p-5 [--i:2]">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[1.125rem] font-black">
              Level {level.level} · {levelTitle(level.level)}
            </h2>
            <span className="text-[0.8125rem] font-extrabold text-ink-subtle">
              {level.xpIntoLevel}/{level.xpForNext} XP
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`Progres ke level ${level.level + 1}`}
            aria-valuenow={level.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3.5 overflow-hidden rounded-full bg-canvas-deep"
          >
            <div
              className="grow-x h-full rounded-full bg-primary shadow-[inset_0_-4px_0_rgba(0,0,0,0.12)]"
              style={{ width: `${level.progress}%` }}
            />
          </div>
          <p className="text-[0.8125rem] text-ink-subtle">Selesai unit: +{XP_REWARDS.unitComplete} XP</p>
        </Card>

        <Link
          href="/kosakata/review"
          className="rise flex items-center gap-3.5 rounded-plate border-2 border-mango-line bg-mango-soft px-[18px] py-4 text-mango-ink shadow-[0_4px_0_var(--color-mango-line)] transition-transform [--i:3] active:translate-y-1 active:shadow-none"
        >
          <span className="grid size-[52px] shrink-0 place-items-center rounded-[12px] border-2 border-mango-line bg-white font-display text-[1.125rem] font-black">
            Aa
          </span>
          <span className="flex-1">
            <strong className="block font-display text-[1.0625rem]">{dueText}</strong>
            <span className="text-[0.875rem]">Kosakata SRS · +{XP_REWARDS.vocabCard} XP/kartu</span>
          </span>
          <ChevronRight className="size-5" strokeWidth={2.6} aria-hidden />
        </Link>

        <Link
          href="/eptr"
          className="rise flex items-center gap-3 rounded-plate bg-charcoal px-[18px] py-4 text-charcoal-ink shadow-[0_4px_0_#000] transition-transform [--i:4] active:translate-y-1 active:shadow-none"
        >
          <Kaka mood="coach" size={56} />
          <span className="flex-1">
            <strong className="block font-display text-[1.0625rem]">
              {daysToTest !== null ? `EPrT · ${daysToTest} hari lagi` : "Tes EPrT"}
            </strong>
            <span className="text-[0.875rem] text-charcoal-muted">
              {target ? `Target skor ${target.score}` : "Simulasi dan latihan per topik"}
            </span>
          </span>
          <ChevronRight className="size-5 text-mango" strokeWidth={2.6} aria-hidden />
        </Link>

        <Link
          href="/liga"
          className="rise flex items-center gap-3.5 rounded-plate border-2 border-hairline bg-surface px-[18px] py-4 shadow-card transition-transform [--i:5] active:translate-y-1 active:shadow-none"
        >
          <span
            className="grid size-11 shrink-0 place-items-center rounded-[12px] border-2 font-round text-[1.125rem] font-extrabold"
            style={{ background: `${tier.fill}33`, borderColor: tier.fill, color: tier.stroke }}
          >
            {league.rank ? `#${league.rank}` : <Trophy className="size-5" aria-hidden />}
          </span>
          <span className="flex-1">
            <strong className="block text-[0.9375rem]">Liga {tier.name}</strong>
            <span className="text-[0.8125rem] text-ink-subtle">
              {league.next
                ? `${league.next.gap} XP lagi buat salip ${league.next.name}`
                : league.optIn
                  ? "Kamu memimpin minggu ini"
                  : `${league.weekXp} XP minggu ini`}
            </span>
          </span>
          <ChevronRight className="size-[18px] text-ink-subtle" strokeWidth={2.6} aria-hidden />
        </Link>

        {latestEssay ? (
          <p className="px-1 text-[0.8125rem] text-ink-subtle">
            Esai terakhir: skor {latestEssay.total} ({relativeDay(latestEssay.createdAt)}) ·{" "}
            <Link href={`/writing/${latestEssay.id}`} className="font-bold text-primary-deep hover:underline">
              Lihat
            </Link>
          </p>
        ) : null}
      </aside>
    </div>
  );
}
