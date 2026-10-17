/**
 * Pemetaan CEFR ↔ level ↔ frekuensi kata, dan band level untuk pemilihan soal.
 * Dipakai untuk penempatan (placement), gating konten, dan peta kemampuan.
 */

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Cefr = (typeof CEFR_LEVELS)[number];

export type WordLevel = "basic" | "intermediate" | "advanced";

/** Padanan kasar level ↔ CEFR. */
export const LEVEL_TO_CEFR: Record<WordLevel, Cefr> = {
  basic: "A2",
  intermediate: "B1",
  advanced: "B2",
};

export const CEFR_TO_LEVEL: Record<Cefr, WordLevel> = {
  A1: "basic",
  A2: "basic",
  B1: "intermediate",
  B2: "intermediate",
  C1: "advanced",
  C2: "advanced",
};

/**
 * Band frekuensi kata per level:
 * - basic: rank 1–1000 (kata paling sering)
 * - intermediate: 1001–2500
 * - advanced: 2501+
 * Kalau frequencyRank null, jatuh ke level tebakan.
 */
export function frequencyBand(rank: number | null): WordLevel {
  if (rank === null || rank <= 0) return "intermediate";
  if (rank <= 1000) return "basic";
  if (rank <= 2500) return "intermediate";
  return "advanced";
}

/** Estimasi CEFR dari total XP (kurva sederhana untuk placement awal). */
export function cefrFromXp(totalXp: number): Cefr {
  if (totalXp >= 12000) return "C1";
  if (totalXp >= 6000) return "B2";
  if (totalXp >= 2500) return "B1";
  if (totalXp >= 800) return "A2";
  return "A1";
}

export function cefrLabel(cefr: Cefr): string {
  const map: Record<Cefr, string> = {
    A1: "Pemula",
    A2: "Dasar",
    B1: "Menengah",
    B2: "Menengah atas",
    C1: "Mahir",
    C2: "Sangat mahir",
  };
  return map[cefr];
}

/** Band CEFR dari peringkat frekuensi: makin sering dipakai, makin dasar. */
export function cefrForFrequencyRank(rank: number): Cefr {
  if (rank <= 1000) return "A2";
  if (rank <= 2500) return "B1";
  return "B2";
}

/** Tahap berikutnya (untuk progres "B1 → B2"). */
export function nextCefr(cefr: Cefr): Cefr | null {
  const index = CEFR_LEVELS.indexOf(cefr);
  return CEFR_LEVELS[index + 1] ?? null;
}

/**
 * Konversi skor EPrT total (310–677) ke CEFR kasar.
 * Berdasarkan pemetaan umum TOEFL ITP → CEFR.
 */
export function cefrFromEprtScore(score: number): Cefr {
  if (score >= 627) return "C1";
  if (score >= 543) return "B2";
  if (score >= 460) return "B1";
  if (score >= 420) return "A2";
  return "A1";
}