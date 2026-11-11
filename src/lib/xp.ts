/** Poin XP untuk tiap jenis aktivitas. */
export const XP_REWARDS = {
  grammarLesson: 20,
  grammarExercise: 5,
  vocabCard: 3,
  unitComplete: 30,
} as const;

/**
 * Batas harian XP per-reason untuk sumber yang dulunya tanpa cap (audit
 * keamanan P1: lesson/unit/exercise bisa dipompa lewat pemanggilan server
 * action langsung). 100/day lesson ≈ 5 materi, 60/day exercise ≈ 12 soal,
 * 90/day unit ≈ 3 unit.
 */
export const XP_DAILY_CAPS = {
  lesson: 100,
  exercise: 60,
  unit: 90,
} as const;

export type XpReason = keyof typeof XP_REWARDS;

/** Total XP yang dibutuhkan untuk mencapai sebuah level (kurva bertingkat). */
export function xpForLevel(level: number) {
  if (level <= 1) return 0;
  // 100 XP untuk level 2, lalu bertambah 50 tiap level berikutnya.
  const n = level - 1;
  return 50 * n * (n + 1) / 2 + 50 * n;
}

export type LevelState = {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number;
};

/** Hitung level dan progres dari total XP. */
export function levelFromXp(totalXp: number): LevelState {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;

  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - base;
  const into = xp - base;
  return {
    level,
    xpIntoLevel: into,
    xpForNext: span,
    progress: span > 0 ? Math.round((into / span) * 100) : 100,
  };
}

/** Nama gelar per level supaya terasa seperti naik pangkat. */
export function levelTitle(level: number) {
  if (level >= 30) return "Ahli";
  if (level >= 20) return "Mahir";
  if (level >= 12) return "Lancar";
  if (level >= 6) return "Menengah";
  if (level >= 3) return "Pemula lanjut";
  return "Pemula";
}

export const DAILY_GOAL_XP = 50;

export function dailyGoalProgress(todayXp: number, goal = DAILY_GOAL_XP) {
  return {
    done: todayXp,
    goal,
    reached: todayXp >= goal,
    progress: Math.min(100, Math.round((todayXp / goal) * 100)),
  };
}