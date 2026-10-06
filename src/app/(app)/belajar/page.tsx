import {
  ArrowRight,
  BookOpen,
  Flame,
  Play,
  SpellCheck,
} from "lucide-react";
import Link from "next/link";

import { GaugeRing } from "@/components/charts";
import { Card } from "@/components/ui/card";
import { grammarStats } from "@/db/queries/grammar";
import { learningPath, totalXp, xpByDay } from "@/db/queries/learning";
import { listDueCards, vocabularyStats } from "@/db/queries/vocabulary";
import { listWritingSubmissions } from "@/db/queries/writing";
import { percentage, relativeDay, todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { shiftDate, streakDays } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { DAILY_GOAL_XP, levelFromXp, levelTitle } from "@/lib/xp";

import { UnitMap } from "./unit-map";

export const metadata = { title: "Jalur Belajar · EnglishApp" };

export default async function BelajarPage() {
  const user = await requireUser();
  const today = todayISO();

  const [units, xp, lessonStats, vocabStats, dueCards, submissions, xpByDate] = await Promise.all([
    learningPath(user.id),
    totalXp(user.id),
    grammarStats(user.id),
    vocabularyStats(user.id),
    listDueCards(user.id, 20),
    listWritingSubmissions(user.id, 1),
    // 60 hari ke belakang supaya perhitungan streak akurat.
    xpByDay(user.id, shiftDate(today, -59), today),
  ]);
  const reviewCount = vocabStats.due;

  const level = levelFromXp(xp);
  const streak = streakDays(
    [...xpByDate].filter(([, amount]) => amount > 0).map(([date]) => date),
    today,
  );

  const doneUnits = units.filter((unit) => unit.state === "done").length;
  const currentUnit = units.find((unit) => unit.state === "current") ?? null;
  const todayXp = xpByDate.get(today) ?? 0;
  const latestEssay = submissions[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow text-ink-subtle">Jalur Belajar</p>
          <h1 className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[2.5rem]">
            Halo {user.displayName ?? user.username}, siap naik level?
          </h1>
          <p className="text-[0.9375rem] text-ink-subtle">
            Level {level.level} · {levelTitle(level.level)} · {xp} XP total. Selesaikan unit berurutan
            dari atas ke bawah.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-plate border-2 border-hairline bg-surface px-5 py-3 shadow-card">
          <GaugeRing
            value={Math.round((todayXp / DAILY_GOAL_XP) * 100)}
            label="Target harian"
            caption={`${todayXp}/${DAILY_GOAL_XP} XP`}
            size={84}
          />
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-[0.9375rem] font-bold text-ink">
              <Flame className="size-4 text-warning" aria-hidden />
              {streak > 0 ? `Streak ${streak} hari` : "Mulai streak hari ini"}
            </span>
            <span className="text-[0.8125rem] text-ink-subtle">
              {todayXp >= DAILY_GOAL_XP
                ? "Target harian tercapai, keren!"
                : `Target harian ${DAILY_GOAL_XP} XP, kira-kira 10 menit.`}
            </span>
          </div>
        </div>
      </header>

      <section aria-label="Peta unit" className="flex flex-col gap-3">
        {units.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 p-6">
            <p className="font-display text-[1.25rem] font-extrabold">Jalur belajar belum diisi</p>
            <p className="text-[0.9375rem] text-ink-subtle">
              Jalankan <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">npm run db:seed</code>{" "}
              untuk mengisi 10 unit pertama beserta materi dan kosakatanya.
            </p>
          </Card>
        ) : (
          <UnitMap units={units} />
        )}
      </section>

      <section aria-labelledby="pintasan-title" className="flex flex-col gap-4">
        <h2 id="pintasan-title" className="font-display text-[1.5rem] font-extrabold">
          Belajar cara lain
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ShortcutCard
            href="/kosakata"
            icon={<SpellCheck className="size-5" aria-hidden />}
            title="Kosakata (SRS)"
            detail={
              reviewCount > 0
                ? `${reviewCount} kartu jatuh tempo hari ini`
                : dueCards.length > 0
                  ? `${dueCards.length} kata baru menantimu`
                  : "Ulangi kata dengan flashcard"
            }
            accent={reviewCount > 0}
          />
          <ShortcutCard
            href="/materi"
            icon={<BookOpen className="size-5" aria-hidden />}
            title="Materi Grammar"
            detail={`${lessonStats.completed}/${lessonStats.total} materi selesai`}
          />
          <ShortcutCard
            href="/writing"
            icon={<ArrowRight className="size-5" aria-hidden />}
            title="Writing Coach"
            detail={
              latestEssay
                ? `Esai terakhir: skor ${latestEssay.total} (${relativeDay(latestEssay.createdAt)})`
                : "Tulis esai, dinilai AI"
            }
          />
          <ShortcutCard
            href="/eptr"
            icon={<Play className="size-5" aria-hidden />}
            title="Tes EPrT"
            detail="Simulasi & latihan soal"
          />
        </div>
      </section>

      {currentUnit ? (
        <section
          aria-labelledby="lanjut-title"
          className="hero-action flex flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10"
        >
          <div className="relative z-[1] flex flex-col gap-1.5">
            <span className="eyebrow text-[#bfe3cf]">Lanjutkan</span>
            <h2 id="lanjut-title" className="font-display text-[1.5rem] font-extrabold">
              {currentUnit.title}
            </h2>
            <p className="text-[0.9375rem] text-[#cfe8d8]">{currentUnit.description}</p>
          </div>
          <Link
            href={`/belajar/${currentUnit.slug}`}
            className="relative z-[1] flex h-12 shrink-0 items-center gap-2 rounded-control bg-white px-6 text-[0.9375rem] font-bold text-primary-deep shadow-card transition-transform hover:-translate-y-0.5"
          >
            Buka unit
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      ) : null}

      <section aria-label="Ringkasan progres" className="grid gap-3 sm:grid-cols-3">
        <Card className="flex flex-col gap-1.5 p-5">
          <span className="text-[0.875rem] font-bold text-ink-subtle">Unit selesai</span>
          <span className="tnum font-round text-[2rem] font-extrabold leading-none text-primary">
            {doneUnits}
            <span className="text-[1rem] text-ink-subtle"> / {units.length}</span>
          </span>
          <span className="text-[0.8125rem] text-ink-subtle">{percentage(doneUnits, units.length)}% jalur dituntaskan</span>
        </Card>
        <Card className="flex flex-col gap-1.5 p-5">
          <span className="text-[0.875rem] font-bold text-ink-subtle">Materi grammar</span>
          <span className="tnum font-round text-[2rem] font-extrabold leading-none text-primary">
            {lessonStats.completed}
            <span className="text-[1rem] text-ink-subtle"> / {lessonStats.total}</span>
          </span>
          <span className="text-[0.8125rem] text-ink-subtle">Lengkap dengan latihan mandiri</span>
        </Card>
        <Card className="flex flex-col gap-1.5 p-5">
          <span className="text-[0.875rem] font-bold text-ink-subtle">Progres level</span>
          <span className="tnum font-round text-[2rem] font-extrabold leading-none text-primary">
            {level.progress}%
          </span>
          <span className="text-[0.8125rem] text-ink-subtle">
            {level.xpIntoLevel}/{level.xpForNext} XP ke level {level.level + 1}
          </span>
        </Card>
      </section>
    </div>
  );
}

function ShortcutCard({
  href,
  icon,
  title,
  detail,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "clay clay-hover flex items-center gap-4 p-4",
        accent && "border-primary bg-primary-soft",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-[12px] border-2",
          accent ? "border-primary/30 bg-white text-primary" : "border-hairline bg-surface-muted text-primary",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-bold text-ink">{title}</span>
        <span className="block truncate text-[0.8125rem] text-ink-subtle">{detail}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
    </Link>
  );
}
