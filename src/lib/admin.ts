import type { NewVocabulary, UserRole } from "@/db/schema";

import { fingerprint, questionText } from "./question-variety";
import { parseQuestions } from "./toefl";

/** Pelajar dianggap "nyangkut" di sebuah kata setelah lupa sebanyak ini. */
export const LEECH_LAPSES = 4;
/** Kata ditandai leech kalau minimal sebanyak ini pelajar nyangkut di kata itu. */
export const LEECH_MIN_LEARNERS = 2;

export type WordStat = { reviews: number; lapses: number; leechLearners: number };

export function isLeech(stat: WordStat | undefined) {
  return (stat?.leechLearners ?? 0) >= LEECH_MIN_LEARNERS;
}

/** Persen lupa = total lupa / total ulang. Null kalau belum pernah diulang. */
export function lapseRate(stat: WordStat | undefined) {
  if (!stat || stat.reviews === 0) return null;
  return Math.min(1, stat.lapses / stat.reviews);
}

type WordFields = Pick<NewVocabulary, "phonetic" | "exampleEn" | "exampleId" | "cefr">;

/** Bagian kartu yang masih kosong, untuk tab "Belum lengkap". */
export function missingFields(word: WordFields) {
  const missing: string[] = [];
  if (!word.phonetic?.trim()) missing.push("fonetik");
  if (!word.exampleEn?.trim()) missing.push("contoh");
  if (!word.exampleId?.trim()) missing.push("terjemahan contoh");
  if (!word.cefr) missing.push("CEFR");
  return missing;
}

const LEVELS = ["basic", "intermediate", "advanced"] as const;
const CEFRS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type WordInput = Omit<NewVocabulary, "wordLower" | "id" | "createdAt" | "updatedAt">;

/** Validasi form kata dari admin. Kolom opsional yang kosong disimpan sebagai null. */
export function parseWordInput(get: (key: string) => string | null): { values: WordInput } | { error: string } {
  const text = (key: string, max: number) => {
    const value = (get(key) ?? "").trim().slice(0, max);
    return value || null;
  };
  const word = text("word", 80);
  const meaning = text("meaning", 200);
  if (!word) return { error: "Kata wajib diisi." };
  if (!meaning) return { error: "Arti wajib diisi." };

  const level = get("level");
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) return { error: "Level tidak dikenal." };
  const cefrRaw = get("cefr") || null;
  if (cefrRaw && !CEFRS.includes(cefrRaw as (typeof CEFRS)[number])) return { error: "CEFR tidak dikenal." };

  const rankRaw = (get("frequencyRank") ?? "").trim();
  const rank = rankRaw ? Number(rankRaw) : null;
  if (rank !== null && (!Number.isInteger(rank) || rank < 1)) {
    return { error: "Peringkat frekuensi harus bilangan bulat positif." };
  }

  return {
    values: {
      word,
      meaning,
      phonetic: text("phonetic", 80),
      partOfSpeech: text("partOfSpeech", 30),
      exampleEn: text("exampleEn", 300),
      exampleId: text("exampleId", 300),
      level: level as (typeof LEVELS)[number],
      cefr: cefrRaw as (typeof CEFRS)[number] | null,
      topic: text("topic", 60),
      frequencyRank: rank,
      mnemonic: text("mnemonic", 200),
    },
  };
}

/** Geser satu id naik (-1) atau turun (+1). Di ujung daftar, urutan tidak berubah. */
export function moveInOrder<T>(ids: T[], id: T, dir: -1 | 1): T[] {
  const from = ids.indexOf(id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = ids.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export type QuestionEdit = { q: string; options: string[]; answer: number; explain: string };

/** Penjelasan per soal minimal sepanjang ini (Lori harus benar-benar menjelaskan). */
export const MIN_EXPLAIN_CHARS = 20;

/**
 * Terapkan suntingan admin ke item bank (JSON { passage, questions[] }).
 * Mengembalikan JSON baru + sidik jari lama yang statistiknya harus direset:
 * statistik kalibrasi dihitung terhadap kunci lama, jadi tidak berlaku lagi
 * kalau teks, pilihan, atau kunci soal berubah.
 */
export function editBankItem(
  raw: string,
  edit: { passage: string | null; questions: QuestionEdit[] },
): { item: string; resetPrints: string[] } | { error: string } {
  let stored: { passage?: unknown; questions?: unknown };
  try {
    stored = JSON.parse(raw);
  } catch {
    return { error: "Item rusak dan tidak bisa disunting. Tarik saja dari bank." };
  }
  const rawQuestions = Array.isArray(stored.questions) ? (stored.questions as Record<string, unknown>[]) : [];
  const current = parseQuestions(JSON.stringify(rawQuestions));
  if (current.length !== rawQuestions.length || current.length !== edit.questions.length) {
    return { error: "Struktur item tidak cocok. Muat ulang halaman lalu coba lagi." };
  }
  if (typeof stored.passage === "string" && !edit.passage?.trim()) return { error: "Bacaan tidak boleh kosong." };
  // Bacaan berubah = jawaban semua soal di bawahnya bisa ikut berubah.
  const passageChanged = typeof stored.passage === "string" && stored.passage.trim() !== edit.passage?.trim();

  const resetPrints: string[] = [];
  const questions = [];
  for (const [index, next] of edit.questions.entries()) {
    const label = `Soal ${index + 1}`;
    const q = next.q.trim();
    const options = next.options.map((option) => option.trim());
    if (!q) return { error: `${label}: teks soal kosong.` };
    if (options.length !== current[index].options.length || options.some((option) => !option)) {
      return { error: `${label}: semua pilihan wajib diisi.` };
    }
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
      return { error: `${label}: ada pilihan yang sama.` };
    }
    if (!Number.isInteger(next.answer) || next.answer < 0 || next.answer >= options.length) {
      return { error: `${label}: pilih kunci jawaban.` };
    }
    if (next.explain.trim().length < MIN_EXPLAIN_CHARS) {
      return { error: `${label}: penjelasan minimal ${MIN_EXPLAIN_CHARS} karakter.` };
    }

    const before = current[index];
    const changed =
      passageChanged ||
      before.q !== q ||
      before.answer !== next.answer ||
      before.options.some((option, i) => option !== options[i]);
    if (changed) resetPrints.push(fingerprint(questionText(before)));
    questions.push({ ...rawQuestions[index], q, options, answer: next.answer, explain_id: next.explain.trim() });
  }

  const passage = typeof stored.passage === "string" ? edit.passage!.trim() : (stored.passage ?? null);
  return { item: JSON.stringify({ ...stored, passage, questions }), resetPrints };
}

/**
 * Admin tidak boleh mencabut perannya sendiri, dan sistem tidak boleh
 * kehabisan admin (supaya tidak ada yang terkunci di luar panel).
 */
export function roleChangeError(input: {
  actorId: number;
  targetId: number;
  currentRole: UserRole;
  nextRole: UserRole;
  adminCount: number;
}): string | null {
  if (input.currentRole === input.nextRole) return "Peran tidak berubah.";
  if (input.nextRole === "user" && input.actorId === input.targetId) {
    return "Kamu tidak bisa mencabut peran admin milikmu sendiri.";
  }
  if (input.nextRole === "user" && input.currentRole === "admin" && input.adminCount <= 1) {
    return "Harus ada minimal satu admin.";
  }
  return null;
}

/** Ringkasan item bank soal (JSON { passage, questions[] }) untuk tabel admin. */
export function bankItemPreview(raw: string): { text: string; count: number } {
  try {
    const parsed = JSON.parse(raw) as { passage?: string | null; questions?: { q?: string }[] };
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const first = questions.find((q) => typeof q?.q === "string" && q.q.trim())?.q?.trim();
    const text = first ?? parsed.passage?.trim().slice(0, 120) ?? "";
    return { text: text || "(tanpa teks)", count: questions.length };
  } catch {
    return { text: "(item rusak)", count: 0 };
  }
}
