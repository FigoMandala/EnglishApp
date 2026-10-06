import type { GrammarExerciseType } from "@/db/schema";

export const EXERCISE_TYPE_LABEL: Record<GrammarExerciseType, string> = {
  fill: "Isian singkat",
  choice: "Pilihan ganda",
  arrange: "Susun kata",
  translate: "Terjemahkan",
  compose: "Tulis kalimat",
};

export const EXERCISE_TYPE_HINT: Record<GrammarExerciseType, string> = {
  fill: "Isi bagian kosong dengan kata yang tepat.",
  choice: "Pilih satu jawaban yang paling tepat.",
  arrange: "Susun kata acak menjadi kalimat yang benar.",
  translate: "Terjemahkan kalimat ke Bahasa Inggris.",
  compose: "Tulis kalimatmu sendiri memakai kata ini.",
};

export const MAX_ANSWER_CHARS = 400;

/**
 * Normalisasi jawaban: huruf kecil, buang tanda baca, rapikan spasi.
 * Dipakai untuk membandingkan jawaban user dengan kunci tanpa terlalu ketat.
 */
export function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/[.!?,;:"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAnswers(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function parseOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Benar kalau jawaban (setelah normalisasi) sama dengan salah satu kunci. */
export function checkAnswer(type: GrammarExerciseType, answer: string, answers: string[]): boolean {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return false;
  const keys = answers.map(normalizeAnswer).filter(Boolean);
  if (keys.length === 0) return false;

  if (type === "fill" || type === "choice") {
    return keys.includes(normalized);
  }

  // Susun kata / terjemah: abaikan spasi ganda dan tanda baca lewat normalisasi,
  // lalu tetap butuh kecocokan penuh supaya urutan kata benar.
  return keys.includes(normalized);
}

/** Susun daftar kata acak yang stabil untuk soal "arrange". */
export function shuffleWords(words: string[], seed: number): string[] {
  const result = [...words];
  let state = seed || 1;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function validateAnswerText(value: string): string | null {
  if (!value.trim()) return "Jawaban masih kosong.";
  if (value.length > MAX_ANSWER_CHARS) return `Jawaban maksimal ${MAX_ANSWER_CHARS} karakter.`;
  return null;
}