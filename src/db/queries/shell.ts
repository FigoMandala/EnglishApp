import { getEptrTarget } from "@/db/queries/activity";
import { mistakeSummary } from "@/db/queries/drills";
import { listGrammarLessons } from "@/db/queries/grammar";
import { leagueBoard } from "@/db/queries/league";
import { learningPath, totalXp } from "@/db/queries/learning";
import { getStreakState } from "@/db/queries/streak";
import { vocabularyStats } from "@/db/queries/vocabulary";
import { daysBetween, todayISO } from "@/lib/dates";
import { levelFromXp } from "@/lib/xp";

/** Satu query gagal tidak boleh menjatuhkan seluruh layout. */
function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch(() => fallback);
}

export type ShellSummary = {
  streak: number;
  xp: number;
  level: number;
  dueCards: number;
  openMistakes: number;
  daysToTest: number | null;
  leagueRank: number | null;
  current: { order: number; title: string; slug: string; done: number; total: number } | null;
};

/** Ringkasan kecil untuk sidebar/tab bar: streak, XP, level, angka "perlu dikerjakan", unit berjalan. */
export async function shellSummary(userId: number): Promise<ShellSummary> {
  const today = todayISO();
  const [xp, streak, vocab, mistakes, units, lessons, target, league] = await Promise.all([
    safe(totalXp(userId), 0),
    safe(getStreakState(userId, today), null),
    safe(vocabularyStats(userId), null),
    safe(mistakeSummary(userId), null),
    safe(learningPath(userId), []),
    safe(listGrammarLessons(userId), []),
    safe(getEptrTarget(userId), null),
    safe(leagueBoard(userId, today), null),
  ]);

  const index = units.findIndex((unit) => unit.state === "current");
  const unit = index >= 0 ? units[index] : null;
  const doneSlugs = new Set(lessons.filter((lesson) => lesson.completed).map((lesson) => lesson.slug));
  const grammarItems = unit?.items.filter((item) => item.kind === "grammar") ?? [];

  return {
    streak: streak?.streak ?? 0,
    xp,
    level: levelFromXp(xp).level,
    dueCards: vocab?.due ?? 0,
    openMistakes: mistakes?.openTotal ?? 0,
    daysToTest: target?.testDate ? Math.max(0, daysBetween(today, target.testDate)) : null,
    leagueRank: league?.rank ?? null,
    current: unit
      ? {
          order: index + 1,
          title: unit.title.replace(/^Unit \d+:\s*/, ""),
          slug: unit.slug,
          done: grammarItems.filter((item) => item.refSlug && doneSlugs.has(item.refSlug)).length,
          total: grammarItems.length,
        }
      : null,
  };
}
