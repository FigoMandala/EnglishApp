export const WRITING_ASPECTS = ["task", "organization", "grammar", "vocabulary"] as const;
export type WritingAspect = (typeof WRITING_ASPECTS)[number];

export const ASPECT_LABEL: Record<WritingAspect, string> = {
  task: "Isi & relevansi",
  organization: "Struktur & koherensi",
  grammar: "Grammar",
  vocabulary: "Kosakata",
};

export const ASPECT_HINT: Record<WritingAspect, string> = {
  task: "Apakah seluruh pertanyaan dijawab dan ide utamanya jelas",
  organization: "Paragraf, topic sentence, dan alurnya runtut",
  grammar: "Tenses, agreement, klausa, dan tanda baca",
  vocabulary: "Pilihan kata tepat dan bervariasi",
};

export const ESSAY_MIN_WORDS = 120;
export const ESSAY_MAX_WORDS = 700;
export const ESSAY_MAX_CHARS = 8_000;

/** Batas latihan "paragraf kilat": satu paragraf, bukan esai penuh. */
export const PARAGRAPH_MIN_WORDS = 50;
export const PARAGRAPH_MAX_WORDS = 180;

export type AspectFeedback = {
  aspect: WritingAspect;
  score: number;
  note: string;
};

export type WritingCorrection = {
  original: string;
  correction: string;
  reason: string;
};

export type WritingScore = {
  total: number;
  aspects: AspectFeedback[];
  strengths: string[];
  improvements: string[];
  corrections: WritingCorrection[];
  summary: string;
};

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function extractJson(raw: string) {
  const stripped = raw.replace(/ thinking[\s\S]*?<\/think>/gi, "").trim();
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? stripped).trim();
  const start = candidate.search(/[{[]/);
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (start < 0 || end <= start) return candidate;
  return candidate.slice(start, end + 1);
}

function clampScore(value: unknown) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), 100);
}

function stringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      const text = String(entry ?? "").trim().slice(0, 300);
      return text ? [text] : [];
    })
    .slice(0, limit);
}

function parseAspects(value: unknown): AspectFeedback[] {
  const raw = Array.isArray(value) ? value : [];
  return WRITING_ASPECTS.map((aspect) => {
    const entry = raw.find(
      (item) => typeof item === "object" && item !== null && (item as Record<string, unknown>).aspect === aspect,
    ) as Record<string, unknown> | undefined;
    return {
      aspect,
      score: clampScore(entry?.score),
      note: String(entry?.note ?? "").trim().slice(0, 500),
    };
  });
}

function parseCorrections(value: unknown): WritingCorrection[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry): WritingCorrection[] => {
      if (typeof entry !== "object" || entry === null) return [];
      const record = entry as Record<string, unknown>;
      const original = String(record.original ?? "").trim().slice(0, 400);
      const correction = String(record.correction ?? "").trim().slice(0, 400);
      const reason = String(record.reason ?? "").trim().slice(0, 400);
      if (!original || !correction) return [];
      return [{ original, correction, reason }];
    })
    .slice(0, 12);
}

/** Ubah respons AI menjadi WritingScore yang aman; kosong kalau tidak bisa dibaca. */
export function parseWritingScore(raw: string): WritingScore | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const aspects = parseAspects(record.aspects);
  if (aspects.every((aspect) => aspect.score === 0 && !aspect.note)) return null;

  const scored = aspects.filter((aspect) => aspect.score > 0 || aspect.note);
  const total = scored.length
    ? Math.round(scored.reduce((sum, aspect) => sum + aspect.score, 0) / scored.length)
    : 0;

  return {
    total,
    aspects,
    strengths: stringList(record.strengths, 5),
    improvements: stringList(record.improvements, 6),
    corrections: parseCorrections(record.corrections),
    summary: String(record.summary ?? "").trim().slice(0, 1_200),
  };
}

export function parseStoredScore(raw: string | null): WritingScore | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WritingScore;
  } catch {
    return null;
  }
}

/** Cek panjang paragraf kilat; kembalikan pesan error atau null kalau lolos. */
export function validateParagraph(text: string): string | null {
  if (!text.trim()) return "Paragraf masih kosong.";
  if (text.length > ESSAY_MAX_CHARS) return `Paragraf maksimal ${ESSAY_MAX_CHARS} karakter.`;
  const words = wordCount(text);
  if (words < PARAGRAPH_MIN_WORDS) return `Paragraf minimal ${PARAGRAPH_MIN_WORDS} kata (sekarang ${words}).`;
  if (words > PARAGRAPH_MAX_WORDS) return `Paragraf maksimal ${PARAGRAPH_MAX_WORDS} kata (sekarang ${words}).`;
  return null;
}

/** Cek panjang esai; kembalikan pesan error atau null kalau lolos. */
export function validateEssay(text: string): string | null {
  if (!text.trim()) return "Tulisan masih kosong.";
  if (text.length > ESSAY_MAX_CHARS) return `Tulisan maksimal ${ESSAY_MAX_CHARS} karakter.`;
  const words = wordCount(text);
  if (words < ESSAY_MIN_WORDS) return `Tulisan minimal ${ESSAY_MIN_WORDS} kata (sekarang ${words}).`;
  if (words > ESSAY_MAX_WORDS) return `Tulisan maksimal ${ESSAY_MAX_WORDS} kata (sekarang ${words}).`;
  return null;
}