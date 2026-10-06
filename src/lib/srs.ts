export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30] as const;
export const MAX_REVIEW_BOX = REVIEW_INTERVALS.length - 1;

export type ReviewState = { box: number; dueAt: string };

/** State FSRS-lite: interval adaptif + faktor kemudahan (×100). */
export type FsrsState = {
  box: number;
  dueAt: string;
  easeFactor: number;
  intervalDays: number;
  lapses: number;
};

const DEFAULT_EASE = 250; // 2.5
const MIN_EASE = 130; // 1.3
const MAX_EASE = 320; // 3.2

export function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function todayISO(at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function nextReview(box: number, correct: boolean, today: string): ReviewState {
  const next = correct ? Math.min(box + 1, MAX_REVIEW_BOX) : 0;
  return { box: next, dueAt: shiftDate(today, correct ? REVIEW_INTERVALS[next] : 1) };
}

/**
 * FSRS-lite: interval tumbuh mengikuti easeFactor, bukan tangga tetap.
 * - Jawab benar: interval × ease (ease naik sedikit kalau kualitas bagus).
 * - Jawab salah: reset ke 1 hari, ease turun, lapses bertambah.
 */
export function nextReviewFsrs(state: {
  box: number;
  easeFactor: number;
  intervalDays: number;
  lapses: number;
  correct: boolean;
  today: string;
}): FsrsState {
  const ease = Math.max(MIN_EASE, Math.min(MAX_EASE, state.easeFactor || DEFAULT_EASE));

  if (!state.correct) {
    const nextEase = Math.max(MIN_EASE, ease - 20);
    return {
      box: 0,
      dueAt: shiftDate(state.today, 1),
      easeFactor: nextEase,
      intervalDays: 1,
      lapses: (state.lapses || 0) + 1,
    };
  }

  const box = Math.min(state.box + 1, MAX_REVIEW_BOX);
  // Interval pertama 1 hari, lalu dikali ease bertahap.
  const base = state.intervalDays > 0 ? state.intervalDays : 1;
  const raw = state.intervalDays > 0 ? Math.round(base * (ease / 100)) : 1;
  const intervalDays = Math.max(1, Math.min(365, raw));
  // Ease naik sedikit kalau diulang dengan lancar (box tinggi).
  const nextEase = box >= 4 ? Math.min(MAX_EASE, ease + 5) : ease;

  return {
    box,
    dueAt: shiftDate(state.today, intervalDays),
    easeFactor: nextEase,
    intervalDays,
    lapses: state.lapses || 0,
  };
}

/** Kata yang sering lupa (leech): lapses tinggi tapi box rendah. */
export function isLeech(lapses: number, box: number) {
  return lapses >= 4 && box <= 2;
}

/**
 * Streak dengan grace day (streak freeze): satu hari bolong tidak memutus
 * selama token beku tersedia.
 */
export function streakDays(studied: Iterable<string>, today: string) {
  const days = new Set(studied);
  let cursor = days.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

/** Streak yang mentoleransi satu hari libur (freeze). */
export function streakDaysWithFreeze(studied: Iterable<string>, today: string, freezeTokens = 1) {
  const days = new Set(studied);
  let cursor = days.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  let freezesLeft = freezeTokens;
  // batasi iterasi supaya tidak loop tak berujung
  for (let guard = 0; guard < 3650; guard += 1) {
    if (days.has(cursor)) {
      streak += 1;
      cursor = shiftDate(cursor, -1);
    } else if (freezesLeft > 0 && streak > 0) {
      freezesLeft -= 1;
      cursor = shiftDate(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}
