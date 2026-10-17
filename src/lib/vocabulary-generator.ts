import type { Vocabulary } from "@/db/schema";

export const VOCAB_LEVELS = ["basic", "intermediate", "advanced"] as const;
export type VocabLevel = (typeof VOCAB_LEVELS)[number];

export const LEVEL_LABEL: Record<VocabLevel, string> = {
  basic: "Dasar",
  intermediate: "Menengah",
  advanced: "Lanjut",
};

export type GeneratedWord = {
  word: string;
  meaning: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  exampleEn: string | null;
  exampleId: string | null;
  level: VocabLevel;
  topic: string | null;
};

function extractJson(raw: string) {
  const stripped = raw.replace(/ thinking[\s\S]*?<\/think>/gi, "").trim();
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? stripped).trim();
  const start = candidate.search(/[{[]/);
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (start < 0 || end <= start) return candidate;
  return candidate.slice(start, end + 1);
}

function text(value: unknown, max = 400) {
  const result = String(value ?? "").trim().replace(/\s+/g, " ");
  return result ? result.slice(0, max) : "";
}

function normalizeLevel(value: unknown, fallback: VocabLevel): VocabLevel {
  const raw = String(value ?? "").trim().toLowerCase();
  return (VOCAB_LEVELS as readonly string[]).includes(raw) ? (raw as VocabLevel) : fallback;
}

export function normalizeWord(value: string) {
  return value.trim().toLowerCase();
}

/** Ubah respons AI menjadi daftar kata yang aman; kosong kalau tidak bisa dibaca. */
export function parseGeneratedWords(
  raw: string,
  fallback: { level: VocabLevel; topic: string },
  existing: Set<string>,
): GeneratedWord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return [];
  }

  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).words)
      ? ((parsed as Record<string, unknown>).words as unknown[])
      : [];
  if (list.length === 0) return [];

  const seen = new Set<string>();
  const result: GeneratedWord[] = [];

  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const word = text(record.word, 60);
    const meaning = text(record.meaning, 200);
    if (!word || !meaning) continue;

    const key = normalizeWord(word);
    if (!/^[a-z][a-z '-]*$/i.test(word)) continue;
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);

    result.push({
      word,
      meaning,
      phonetic: text(record.phonetic, 80) || null,
      partOfSpeech: text(record.partOfSpeech, 40) || null,
      exampleEn: text(record.exampleEn, 300) || null,
      exampleId: text(record.exampleId, 300) || null,
      level: normalizeLevel(record.level, fallback.level),
      topic: text(record.topic, 60) || fallback.topic,
    });
  }

  return result;
}

export type NewVocabRow = Omit<Vocabulary, "id" | "createdAt" | "updatedAt">;

export function toVocabRow(item: GeneratedWord): NewVocabRow {
  return {
    word: item.word,
    wordLower: normalizeWord(item.word),
    meaning: item.meaning,
    phonetic: item.phonetic,
    partOfSpeech: item.partOfSpeech,
    exampleEn: item.exampleEn,
    exampleId: item.exampleId,
    level: item.level,
    topic: item.topic,
    cefr: null,
    frequencyRank: null,
    mnemonic: null,
  };
}