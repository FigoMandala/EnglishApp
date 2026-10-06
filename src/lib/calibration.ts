import type { LevelBand } from "@/db/queries/question-bank";

/** Jumlah jawaban minimal sebelum persen benar sebuah soal dianggap bermakna. */
export const MIN_ATTEMPTS = 8;
/** Di bawah ini (pilihan ganda 4 opsi, tebakan = 25%) kunci jawaban kemungkinan salah atau soal ambigu. */
export const FAULTY_MAX = 0.15;
/** Di atas ini soal tidak lagi membedakan peserta; disaring kecuali untuk level low. */
export const TOO_EASY_MIN = 0.95;

export type Verdict = "unknown" | "ok" | "faulty" | "too-easy";

export type Stat = { attempts: number; correct: number };

export function accuracy(stat: Stat) {
  return stat.attempts ? stat.correct / stat.attempts : null;
}

export function judgeQuestion(stat: Stat | undefined, band: LevelBand): Verdict {
  if (!stat || stat.attempts < MIN_ATTEMPTS) return "unknown";
  const rate = stat.correct / stat.attempts;
  if (rate <= FAULTY_MAX) return "faulty";
  if (rate >= TOO_EASY_MIN && band !== "low") return "too-easy";
  return "ok";
}

export type Row = Stat & { kind: string; levelBand: LevelBand };

export type GroupSummary = {
  band: LevelBand;
  kind: string;
  questions: number;
  attempts: number;
  accuracy: number | null;
  faulty: number;
  tooEasy: number;
  /** Jumlah jawaban kelompok ini belum cukup untuk menilai levelnya. */
  status: "thin" | "on-target" | "too-easy" | "too-hard";
};

/** Jawaban minimal satu kelompok (level x jenis soal) sebelum levelnya dinilai. */
export const MIN_GROUP_ATTEMPTS = 30;

export function summarize(rows: Row[]): GroupSummary[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.levelBand}|${row.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()]
    .map((list) => {
      const { levelBand: band, kind } = list[0];
      const attempts = list.reduce((sum, row) => sum + row.attempts, 0);
      const correct = list.reduce((sum, row) => sum + row.correct, 0);
      const rate = attempts ? correct / attempts : null;
      const [low, high] = EXPECTED_ACCURACY[band];
      const status: GroupSummary["status"] =
        rate === null || attempts < MIN_GROUP_ATTEMPTS
          ? "thin"
          : rate > high
            ? "too-easy"
            : rate < low
              ? "too-hard"
              : "on-target";
      const verdicts = list.map((row) => judgeQuestion(row, band));
      return {
        band,
        kind,
        questions: list.length,
        attempts,
        accuracy: rate,
        faulty: verdicts.filter((v) => v === "faulty").length,
        tooEasy: verdicts.filter((v) => v === "too-easy").length,
        status,
      };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.band.localeCompare(b.band));
}

/** Rentang persen benar yang wajar per level, dipakai laporan untuk menandai level yang melenceng. */
export const EXPECTED_ACCURACY: Record<LevelBand, [number, number]> = {
  low: [0.6, 0.85],
  mid: [0.5, 0.75],
  high: [0.4, 0.65],
};
