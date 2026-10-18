import { CEFR_LEVELS, CEFR_TO_LEVEL, type Cefr, type WordLevel } from "@/lib/cefr";

export const GOAL_IDS = ["eprt", "toefl", "kerja", "kuliah", "ngobrol", "jalan"] as const;
export type GoalId = (typeof GOAL_IDS)[number];

export const DAILY_MINUTES = [5, 10, 15, 20] as const;
export type DailyMinutes = (typeof DAILY_MINUTES)[number];

/** Satu menit belajar kira-kira 5 XP (target harian bawaan 50 XP = 10 menit). */
export const XP_PER_MINUTE = 5;

export type Onboarding = {
  goal: GoalId | null;
  /** Level yang dipilih sendiri (self-report). */
  cefr: Cefr | null;
  dailyMinutes: DailyMinutes;
  /** Hasil tes penempatan, kalau dikerjakan. */
  placement: { score: number; total: number; byLevel: Record<WordLevel, [number, number]> } | null;
};

export const EMPTY_ONBOARDING: Onboarding = { goal: null, cefr: null, dailyMinutes: 10, placement: null };

/** Level akhir: hasil tes menang atas pilihan sendiri. */
export function placedCefr(data: Onboarding): Cefr {
  if (data.placement && data.placement.total > 0) {
    const ratio = data.placement.score / data.placement.total;
    if (ratio < 0.25) return "A1";
    if (ratio < 0.5) return "A2";
    if (ratio < 0.7) return "B1";
    if (ratio < 0.9) return "B2";
    return "C1";
  }
  return data.cefr ?? "A1";
}

/** Tingkat unit yang boleh dilewati karena sudah dikuasai. */
export function levelsToSkip(cefr: Cefr): WordLevel[] {
  const level = CEFR_TO_LEVEL[cefr];
  if (level === "advanced") return ["basic", "intermediate"];
  if (level === "intermediate") return ["basic"];
  return [];
}

/**
 * Validasi ketat payload dari klien (tidak dipercaya). Mengembalikan null kalau bentuknya salah.
 */
export function parseOnboarding(raw: unknown): Onboarding | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (raw.length > 2_000) return null;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  const goal = GOAL_IDS.find((id) => id === v.goal) ?? null;
  const cefr = CEFR_LEVELS.find((id) => id === v.cefr) ?? null;
  const dailyMinutes = DAILY_MINUTES.find((m) => m === v.dailyMinutes) ?? 10;

  let placement: Onboarding["placement"] = null;
  const p = v.placement as Record<string, unknown> | null | undefined;
  if (p && typeof p === "object") {
    const score = Number(p.score);
    const total = Number(p.total);
    if (Number.isInteger(score) && Number.isInteger(total) && total > 0 && total <= 20 && score >= 0 && score <= total) {
      const byLevel: Record<WordLevel, [number, number]> = { basic: [0, 0], intermediate: [0, 0], advanced: [0, 0] };
      const raw = (p.byLevel ?? {}) as Record<string, unknown>;
      for (const level of Object.keys(byLevel) as WordLevel[]) {
        const pair = raw[level];
        if (Array.isArray(pair) && pair.length === 2) {
          const [a, b] = pair.map(Number);
          if (Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= a && b <= 20) byLevel[level] = [a, b];
        }
      }
      placement = { score, total, byLevel };
    }
  }
  return { goal, cefr, dailyMinutes, placement };
}

const KEY = "ea-onboarding";

/** Simpan sementara di sessionStorage sampai pengguna mendaftar. */
export function loadOnboarding(): Onboarding {
  try {
    return parseOnboarding(sessionStorage.getItem(KEY)) ?? EMPTY_ONBOARDING;
  } catch {
    return EMPTY_ONBOARDING;
  }
}

export function saveOnboarding(patch: Partial<Onboarding>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...loadOnboarding(), ...patch }));
  } catch {
    /* penyimpanan diblokir: lanjut tanpa menyimpan */
  }
}
