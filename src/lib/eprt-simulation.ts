import { scaledScore, type ToeflSection } from "@/lib/toefl";

export type SimKind =
  | "listen-short"
  | "listen-long"
  | "listen-lecture"
  | "structure"
  | "written"
  | "reading";

export type SimPart = {
  kind: SimKind;
  section: ToeflSection;
  count: number;
  /** Nomor soal pertama di dalam section-nya, seperti di lembar soal EPrT. */
  first: number;
  title: string;
};

// Susunan EPrT: Listening 50 (30 + 10 + 10), Structure 40 (15 + 25), Reading 50 (5 teks x 10).
export const SIM_PARTS: SimPart[] = [
  { kind: "listen-short", section: "listening", count: 15, first: 1, title: "Listening: Short Dialogue 1-15" },
  { kind: "listen-short", section: "listening", count: 15, first: 16, title: "Listening: Short Dialogue 16-30" },
  { kind: "listen-long", section: "listening", count: 10, first: 31, title: "Listening: Long Dialogue 31-40" },
  { kind: "listen-lecture", section: "listening", count: 10, first: 41, title: "Listening: Lecture 41-50" },
  { kind: "structure", section: "structure", count: 15, first: 1, title: "Structure: Sentence Completion 1-15" },
  { kind: "written", section: "structure", count: 25, first: 16, title: "Structure: Error Recognition 16-40" },
  ...[1, 2, 3, 4, 5].map(
    (n): SimPart => ({
      kind: "reading",
      section: "reading",
      count: 10,
      first: (n - 1) * 10 + 1,
      title: `Reading: Teks ${n} (${(n - 1) * 10 + 1}-${n * 10})`,
    }),
  ),
];

/** Batas waktu tiap section dalam menit, mengikuti EPrT paper-based. */
export const SECTION_MINUTES: Record<ToeflSection, number> = {
  listening: 35,
  structure: 25,
  reading: 55,
};

/** Target soal per panggilan AI saat satu bagian dibuat. Bagian lebih kecil dari
 * ini dibuat sekali; yang lebih besar dipecah supaya tiap request tetap di bawah
 * batas durasi fungsi Vercel. */
export const BATCH_SIZE = 10;

export type PartBatch = { index: number; offset: number; count: number };

/** Ukuran tiap batch untuk satu bagian. Reading tidak dipecah karena soalnya
 * terikat pada satu passage; jenis lain dipecah kalau lebih besar dari BATCH_SIZE. */
export function partBatches(part: SimPart): PartBatch[] {
  const sizes: number[] = [];
  if (part.kind === "reading") {
    sizes.push(part.count);
  } else {
    let left = part.count;
    while (left > 0) {
      const size = Math.min(BATCH_SIZE, left);
      sizes.push(size);
      left -= size;
    }
  }

  let offset = 0;
  return sizes.map((count, index) => {
    const batch = { index, offset, count };
    offset += count;
    return batch;
  });
}

/** Jumlah permintaan AI satu bagian. Dipakai untuk menghitung progres. */
export function batchCount(part: SimPart) {
  return partBatches(part).length;
}

export const SIM_BATCH_TOTAL = SIM_PARTS.reduce((sum, part) => sum + batchCount(part), 0);

/** Toleransi jaringan sebelum jawaban ditolak server. */
export const DEADLINE_GRACE_MS = 5_000;

export type SectionTimers = Partial<Record<ToeflSection, string>>;

/** Mini-test satu section: null berarti simulasi penuh. */
export type SimScope = ToeflSection | null;

/**
 * Section mini-test disimpan di JSON `timers` (kunci `scope`) supaya tidak perlu
 * kolom baru; parseTimers mengabaikan kunci ini.
 */
export function parseScope(raw: string | null): SimScope {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const scope = (parsed as { scope?: unknown } | null)?.scope;
    return typeof scope === "string" && Object.hasOwn(SECTION_MINUTES, scope) ? (scope as ToeflSection) : null;
  } catch {
    return null;
  }
}

export function serializeTimers(timers: SectionTimers, scope: SimScope) {
  return JSON.stringify(scope ? { ...timers, scope } : timers);
}

/** Bagian simulasi yang ikut dikerjakan untuk scope ini, dengan indeks aslinya. */
export function partsInScope(scope: SimScope) {
  return SIM_PARTS.flatMap((part, index) => (!scope || part.section === scope ? [{ part, index }] : []));
}

export function scopeQuestionTotal(scope: SimScope) {
  return partsInScope(scope).reduce((sum, { part }) => sum + part.count, 0);
}

export function parseTimers(raw: string | null): SectionTimers {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== "object" || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    return Object.fromEntries(
      (Object.keys(SECTION_MINUTES) as ToeflSection[]).flatMap((section) =>
        typeof record[section] === "string" ? [[section, record[section]]] : [],
      ),
    );
  } catch {
    return {};
  }
}

/** Sisa waktu section dalam ms; null kalau timer belum dimulai. */
export function remainingMs(timers: SectionTimers, section: ToeflSection, now = Date.now()) {
  const start = timers[section];
  if (!start) return null;
  return Date.parse(start) + SECTION_MINUTES[section] * 60_000 - now;
}

export function isExpired(timers: SectionTimers, section: ToeflSection, now = Date.now()) {
  const left = remainingMs(timers, section, now);
  return left !== null && left < -DEADLINE_GRACE_MS;
}

export const SIM_QUESTION_TOTAL = SIM_PARTS.reduce((sum, part) => sum + part.count, 0);

export function emptyParts() {
  return JSON.stringify(SIM_PARTS.map(() => null));
}

export function parseParts(raw: string | null): (number | null)[] {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const list = Array.isArray(parsed) ? parsed : [];
  return SIM_PARTS.map((_, index) =>
    Number.isInteger(list[index]) && list[index] > 0 ? (list[index] as number) : null,
  );
}

export type SimulationScore = {
  total: number;
  listening: number;
  structure: number;
  reading: number;
  correct: Record<ToeflSection, number>;
  answered: Record<ToeflSection, number>;
};

export function parseScore(raw: string | null): SimulationScore | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SimulationScore;
  } catch {
    return null;
  }
}

/** Skor ala TOEFL ITP/EPrT: tiap section dikonversi ke 31-68, total = rata-rata x 10. */
export function simulationScore(
  results: { section: ToeflSection; correct: number; total: number }[],
): SimulationScore {
  const correct = { listening: 0, structure: 0, reading: 0 };
  const answered = { listening: 0, structure: 0, reading: 0 };
  for (const result of results) {
    correct[result.section] += result.correct;
    answered[result.section] += result.total;
  }
  const scaled = (section: ToeflSection) =>
    scaledScore(section, answered[section] ? correct[section] / answered[section] : 0);
  const listening = scaled("listening");
  const structure = scaled("structure");
  const reading = scaled("reading");
  return {
    total: Math.round(((listening + structure + reading) * 10) / 3),
    listening,
    structure,
    reading,
    correct,
    answered,
  };
}
