import { shiftDate } from "@/lib/srs";

export const MAX_FREEZES = 2;
/** Satu pelindung baru tiap sekian hari belajar. */
export const DAYS_PER_FREEZE = 7;

export type StreakOptions = {
  /** Tanggal yang dilindungi pelindung streak. */
  frozen: readonly string[];
  /** Sabtu dan Minggu tidak memutus streak (dan tidak menambahnya). */
  weekendEasy: boolean;
};

const isWeekend = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/**
 * Hitung streak sampai `today`. Hari ini yang belum belajar tidak memutus streak
 * (masih ada waktu), tapi kemarin yang kosong memutusnya kecuali dilindungi.
 */
export function computeStreak(studied: Iterable<string>, today: string, options: StreakOptions) {
  const covered = new Set<string>([...studied, ...options.frozen]);
  let cursor = covered.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  for (let guard = 0; guard < 4000; guard += 1) {
    if (covered.has(cursor)) streak += 1;
    else if (!(options.weekendEasy && isWeekend(cursor))) break;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

/** Streak terpanjang sepanjang riwayat. */
export function longestStreak(studied: Iterable<string>, today: string, options: StreakOptions) {
  const covered = new Set<string>([...studied, ...options.frozen]);
  if (covered.size === 0) return 0;
  const first = [...covered].sort()[0];
  let best = 0;
  let run = 0;
  let cursor = first;
  for (let guard = 0; guard < 4000 && cursor <= today; guard += 1) {
    if (covered.has(cursor)) {
      run += 1;
      best = Math.max(best, run);
    } else if (!(options.weekendEasy && isWeekend(cursor))) {
      run = 0;
    }
    cursor = shiftDate(cursor, 1);
  }
  return best;
}

/** Pelindung tersedia: terisi 1 tiap 7 hari belajar, maksimal 2, dikurangi yang sudah dipakai. */
export function freezesAvailable(studyDays: number, used: number) {
  const earned = Math.floor(studyDays / DAYS_PER_FREEZE);
  return Math.max(0, Math.min(MAX_FREEZES, earned - used));
}

/** Sisa waktu sampai hari berganti (zona Asia/Jakarta, UTC+7 tanpa DST). */
export function timeLeftToday(now: Date = new Date()) {
  const jakarta = new Date(now.getTime() + 7 * 3600_000);
  const msIntoDay = jakarta.getUTCHours() * 3600_000 + jakarta.getUTCMinutes() * 60_000 + jakarta.getUTCSeconds() * 1000;
  const left = Math.max(0, 24 * 3600_000 - msIntoDay);
  return { hours: Math.floor(left / 3600_000), minutes: Math.floor((left % 3600_000) / 60_000) };
}
