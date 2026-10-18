export type ToeflSection = "structure" | "reading" | "listening";
export type QuestionType = "structure" | "written" | "reading" | "listening";

export const SKILLS = {
  sv: { section: "structure", label: "Subjek & verb", hint: "kalimat butuh subjek dan verb utama" },
  agreement: { section: "structure", label: "Subject-verb agreement", hint: "verb cocok dengan subjeknya" },
  tense: { section: "structure", label: "Tenses & bentuk verb", hint: "tenses dan bentuk verb setelah modal/have/be" },
  passive: { section: "structure", label: "Passive voice", hint: "kalimat pasif be + V3" },
  clause: { section: "structure", label: "Klausa & konektor", hint: "noun/adjective/adverb clause" },
  reduced: { section: "structure", label: "Reduced clause", hint: "participle V-ing/V3, appositive" },
  inversion: { section: "structure", label: "Inversi", hint: "inversi setelah kata negatif atau kondisional" },
  parallel: { section: "structure", label: "Parallel structure", hint: "bentuk sejajar setelah and/or/but" },
  comparison: { section: "structure", label: "Perbandingan", hint: "comparative, superlative, the -er the -er" },
  "noun-pronoun": { section: "structure", label: "Noun & pronoun", hint: "tunggal/jamak dan rujukan pronoun" },
  "word-form": { section: "structure", label: "Bentuk kata", hint: "adjective vs adverb, noun vs verb" },
  "article-prep": { section: "structure", label: "Artikel & preposisi", hint: "a/an/the dan pilihan preposisi" },
  "main-idea": { section: "reading", label: "Main idea", hint: "gagasan utama atau judul yang cocok" },
  detail: { section: "reading", label: "Detail tersurat", hint: "fakta yang disebut langsung" },
  "not-stated": { section: "reading", label: "NOT/EXCEPT", hint: "mana yang tidak disebut bacaan" },
  vocab: { section: "reading", label: "Kosakata", hint: "arti kata dalam konteks" },
  reference: { section: "reading", label: "Rujukan kata", hint: "it/they/this merujuk ke apa" },
  inference: { section: "reading", label: "Inferensi", hint: "kesimpulan tersirat dan sikap penulis" },
  "listen-short": { section: "listening", label: "Percakapan pendek", hint: "makna tersirat, idiom, saran" },
  "listen-long": { section: "listening", label: "Percakapan panjang", hint: "topik, detail, maksud pembicara pada dialog panjang" },
  "listen-lecture": { section: "listening", label: "Monolog atau kuliah", hint: "gagasan utama, detail, dan kesimpulan monolog" },
} as const satisfies Record<string, { section: ToeflSection; label: string; hint: string }>;

export type SkillKey = keyof typeof SKILLS;

export function isSkill(value: unknown): value is SkillKey {
  return typeof value === "string" && Object.hasOwn(SKILLS, value);
}

export type AudioSpeaker = "man" | "woman" | "narrator" | "speaker";
export type AudioLine = { speaker: AudioSpeaker; text: string };

export type ToeflQuestion = {
  type: QuestionType;
  skill: SkillKey | null;
  q: string;
  options: string[];
  answer: number;
  explain_id: string;
  audio?: AudioLine[];
  passage?: string;
  reviewId?: number;
};

export type ToeflAnswer = { skill: SkillKey | null; section: ToeflSection; correct: boolean };

function sectionOf(type: QuestionType): ToeflSection {
  return type === "written" ? "structure" : type;
}

/**
 * Buang nomor yang kadang ditulis AI di awal pertanyaan ("Number 6.", "Question 3:",
 * "12."). Nomor asli ikut basi saat soal diambil dari bank dan diurutkan ulang.
 */
export function stripQuestionNumber(q: string) {
  return q.replace(/^\s*(?:(?:number|question|no\.?)\s*)?\d{1,3}\s*[.):]\s+/i, "").trim();
}

export function parseQuestions(raw: string | null): ToeflQuestion[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const record = entry as Record<string, unknown>;
      const options = Array.isArray(record.options) ? record.options.map(String) : [];
      const answer = Number(record.answer);
      const q = typeof record.q === "string" ? stripQuestionNumber(record.q) : "";
      if (!q || options.length < 2) return [];
      if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return [];
      return [
        {
          type: (record.type as QuestionType) ?? "structure",
          skill: isSkill(record.skill) ? record.skill : null,
          q,
          options,
          answer,
          explain_id: typeof record.explain_id === "string" ? record.explain_id : "",
          audio: Array.isArray(record.audio) ? (record.audio as AudioLine[]) : undefined,
          passage: typeof record.passage === "string" ? record.passage : undefined,
          reviewId: typeof record.reviewId === "number" ? record.reviewId : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function parseAnswers(raw: string | null, count: number): (number | null)[] {
  if (!raw) return Array.from({ length: count }, () => null);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return Array.from({ length: count }, () => null);
    return Array.from({ length: count }, (_, index) =>
      typeof parsed[index] === "number" ? (parsed[index] as number) : null,
    );
  } catch {
    return Array.from({ length: count }, () => null);
  }
}

export function correctCount(questions: ToeflQuestion[], answers: (number | null)[]) {
  return questions.filter((question, index) => answers[index] === question.answer).length;
}

/**
 * Jawaban benar yang jelas paling panjang gampang ditebak tanpa membaca soal.
 * True kalau opsi benar terpanjang dan lebih dari 1,15x opsi terpanjang lainnya (selisih min. 5 karakter).
 */
export function longestAnswerGiveaway(options: string[], answer: number) {
  const others = options.filter((_, index) => index !== answer).map((option) => option.length);
  const longestOther = Math.max(...others);
  const correct = options[answer]?.length ?? 0;
  return correct - longestOther >= 5 && correct > longestOther * 1.15;
}

export function isComplete(answers: (number | null)[]) {
  return answers.length > 0 && answers.every((answer) => answer !== null && answer >= 0);
}

export function collectAnswers(
  sessions: { section: string; questions: ToeflQuestion[]; answers: (number | null)[] }[],
): ToeflAnswer[] {
  return sessions.flatMap(({ section, questions, answers }) => {
    if (section === "review") return [];
    return questions.flatMap((question, index) => {
      const answer = answers[index];
      if (answer === null || answer === undefined || answer < 0) return [];
      return [
        {
          skill: question.skill,
          section: sectionOf(question.type),
          correct: answer === question.answer,
        },
      ];
    });
  });
}

export type SkillStat = { skill: SkillKey; answered: number; pct: number | null };

export function skillStats(answers: ToeflAnswer[]): SkillStat[] {
  return (Object.keys(SKILLS) as SkillKey[]).map((skill) => {
    const mine = answers.filter((answer) => answer.skill === skill);
    const correct = mine.filter((answer) => answer.correct).length;
    return {
      skill,
      answered: mine.length,
      pct: mine.length ? Math.round((correct / mine.length) * 100) : null,
    };
  });
}

const MIN_SECTION_ANSWERS = 10;
const MIN_SKILL_ANSWERS = 3;

export function focusSkills(answers: ToeflAnswer[], section: ToeflSection, count = 2): SkillKey[] {
  if (answers.filter((answer) => answer.section === section).length < MIN_SECTION_ANSWERS) return [];
  return skillStats(answers)
    .filter(({ skill }) => SKILLS[skill].section === section)
    .sort((a, b) => {
      const aThin = a.answered < MIN_SKILL_ANSWERS;
      const bThin = b.answered < MIN_SKILL_ANSWERS;
      if (aThin !== bThin) return aThin ? -1 : 1;
      return aThin ? a.answered - b.answered : (a.pct ?? 0) - (b.pct ?? 0);
    })
    .slice(0, count)
    .map(({ skill }) => skill);
}

const CONVERSION: Record<ToeflSection, [number, number][]> = {
  structure: [[0, 31], [0.25, 33], [0.5, 44], [0.75, 54], [1, 68]],
  reading: [[0, 31], [0.2, 31], [0.4, 40], [0.6, 48], [0.8, 55], [1, 67]],
  listening: [[0, 31], [0.2, 33], [0.4, 45], [0.6, 51], [0.8, 57], [1, 68]],
};

export function scaledScore(section: ToeflSection, accuracy: number) {
  const points = CONVERSION[section];
  const value = Math.min(Math.max(accuracy, 0), 1);
  const upper = points.findIndex(([at]) => at >= value);
  if (upper <= 0) return points[0][1];
  const [x0, y0] = points[upper - 1];
  const [x1, y1] = points[upper];
  return Math.round(y0 + ((y1 - y0) * (value - x0)) / (x1 - x0));
}

export type ScoreEstimate = {
  total: number;
  structure: number;
  reading: number;
  listening: number | null;
  /** Total masih memakai asumsi listening karena data kurang lengkap. */
  estimated: boolean;
};

export function estimateScore(answers: ToeflAnswer[]): ScoreEstimate | null {
  const scaled = (section: ToeflSection) => {
    const mine = answers.filter((answer) => answer.section === section);
    if (mine.length < MIN_SECTION_ANSWERS) return null;
    return scaledScore(section, mine.filter((answer) => answer.correct).length / mine.length);
  };
  const structure = scaled("structure");
  const reading = scaled("reading");
  if (structure === null || reading === null) return null;

  const listening = scaled("listening");
  // Jangan mengarang skor listening dari rata-rata structure+reading:
  // itu menyesatkan. Kalau data listening belum cukup, tetap tampilkan
  // total asumsi TAPI tandai `estimated` supaya UI bisa memberi label jelas.
  const assumed = listening ?? Math.round((structure + reading) / 2);
  return {
    total: Math.round(((assumed + structure + reading) * 10) / 3),
    structure,
    reading,
    listening,
    estimated: listening === null,
  };
}

/** Margin of error kasar (±poin) berdasarkan jumlah soal terjawab. */
export function scoreMargin(answers: ToeflAnswer[]): number | null {
  const mine = answers.filter((answer) => answer.section !== undefined);
  if (mine.length === 0) return null;
  // ±3 poin di bawah 10 jawaban/section, menyempit mendekati ±1 di 40.
  const perSection = mine.length / 3;
  return perSection >= 40 ? 1 : perSection >= 20 ? 2 : 3;
}

const isWordChar = (char: string | undefined) =>
  char !== undefined && /[A-Za-z0-9']/.test(char);

export function underlineSpans(sentence: string, parts: string[]) {
  const spans: [number, number][] = [];
  let from = 0;
  for (const part of parts) {
    let start = part ? sentence.indexOf(part, from) : -1;
    while (
      start >= 0 &&
      (isWordChar(sentence[start - 1]) || isWordChar(sentence[start + part.length]))
    ) {
      start = sentence.indexOf(part, start + 1);
    }
    if (start < 0) return null;
    spans.push([start, start + part.length]);
    from = start + part.length;
  }
  return spans;
}

/** Audio tanpa baris narator: identitas dialog/monolog yang sebenarnya. */
export function dialogueKey(question: Pick<ToeflQuestion, "audio">) {
  const lines = (question.audio ?? []).filter((line) => line.speaker !== "narrator");
  return lines.map((line) => `${line.speaker}:${line.text}`).join("\n");
}

/**
 * Nomor soal disusun ulang dari posisi yang benar-benar disajikan, lalu baris
 * narator lama dibuang dan diganti label baru. Soal yang berbagi dialog/monolog
 * memakai satu rentang nomor; tiap soal mendapat satu nomor.
 */
export function renumber(questions: ToeflQuestion[], first: number): ToeflQuestion[] {
  const spans = new Map<string, [number, number]>();
  questions.forEach((question, index) => {
    const key = dialogueKey(question);
    const span = spans.get(key);
    spans.set(key, span ? [span[0], first + index] : [first + index, first + index]);
  });
  return questions.map((question) => {
    if (!question.audio) return question;
    const [from, to] = spans.get(dialogueKey(question)) as [number, number];
    const label = from === to ? `Question ${from}` : `Questions ${from}-${to}`;
    const spoken = question.audio.filter((line) => line.speaker !== "narrator");
    return { ...question, audio: [{ speaker: "narrator", text: label }, ...spoken] };
  });
}
