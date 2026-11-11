import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { toeflSessions } from "@/db/schema";
import { logAiUsage } from "@/db/queries/ai-usage";
import { warmTts } from "@/lib/api/tts";
import { releaseReservation, reserveBudget } from "@/lib/ai-budget";
import {
  countReviews,
  createReview,
  createToeflSession,
  deleteReview,
  findActiveReview,
  getReview,
  getSimulation,
  getToeflSession,
  listDueReviews,
  listToeflSessions,
  setSessionAnswer,
  updateReview,
  updateToeflSession,
  type Track,
} from "@/db/queries/toefl";
import {
  getEptrTarget,
  getEptrTrend,
  getToeflTarget,
  getToeflTrend,
  listActivity,
  logActivity,
  setSetting,
  SETTING_KEYS,
} from "@/db/queries/activity";

import {
  getQuestionStats,
  levelBand,
  markSeen,
  pickUnseenItems,
  recordAnswerStat,
  type LevelBand,
} from "@/db/queries/question-bank";
import { judgeQuestion } from "@/lib/calibration";
import { AiError, setAiConcurrency } from "@/lib/ai-client";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { checkRateLimit } from "@/lib/rate-limit";
import { isExpired, parseTimers } from "@/lib/eprt-simulation";
import {
  fingerprint,
PASSAGE_SIMILAR,
  questionText,
  SimilarityIndex,
} from "@/lib/question-variety";
import { MAX_REVIEW_BOX, nextReview, shiftDate, streakDays, todayISO } from "@/lib/srs";
import {
  collectAnswers,
  estimateScore,
  focusSkills,
  isComplete,
  isSkill,
  longestAnswerGiveaway,
  parseAnswers,
  parseQuestions,
  renumber,
  scaledScore,
  SKILLS,
  skillStats,
  stripQuestionNumber,
  type AudioLine,
  type AudioSpeaker,
  type QuestionType,
  type SkillKey,
  type ToeflQuestion,
  type ToeflSection,
} from "@/lib/toefl";

export type { Track };

const TRACK_SETTINGS: Record<Track, { target: string; trend: string; activity: string }> = {
  toefl: { target: SETTING_KEYS.toeflTarget, trend: SETTING_KEYS.toeflTrend, activity: "toefl" },
  eptr: { target: SETTING_KEYS.eptrTarget, trend: SETTING_KEYS.eptrTrend, activity: "toefl" },
};

function getTrackTarget(userId: number, track: Track) {
  return track === "eptr" ? getEptrTarget(userId) : getToeflTarget(userId);
}

function getTrackTrend(userId: number, track: Track) {
  return track === "eptr" ? getEptrTrend(userId) : getToeflTrend(userId);
}

export type BlockKind =
  | "drill"
  | "written"
  | "reading"
  | "listening"
  | "listening-15"
  | "listen-long"
  | "listen-lecture"
  | "review";

const SPEAKERS: AudioSpeaker[] = ["man", "woman", "narrator", "speaker"];

function isSpeaker(value: unknown): value is AudioSpeaker {
  return typeof value === "string" && (SPEAKERS as string[]).includes(value);
}

const DEFAULT_LEVEL = 500;
const TREND_DAYS = 30;

function skillList(section: ToeflSection) {
  return Object.entries(SKILLS)
    .filter(([, skill]) => skill.section === section)
    .map(([key, skill]) => `${key} = ${skill.hint}`)
    .join("; ");
}

const OPTION_RULES =
  "Aturan opsi supaya jawaban tidak mudah ditebak: keempat opsi HARUS mirip panjang dan struktur kalimatnya (selisih panjang paling banyak sekitar 20%); jawaban benar JANGAN yang paling panjang, paling rinci, atau paling lengkap, dan sering buat distraktor yang sama panjang atau lebih panjang dari jawaban benar. Distraktor harus masuk akal: memakai kata atau fakta dari teks/percakapan tetapi salah makna, salah detail, terlalu umum, atau berlawanan. Jangan buat distraktor yang absurd, tidak nyambung topik, atau memakai kata ekstrem (always, never, only, all) hanya di distraktor. Jangan biarkan jawaban benar satu-satunya yang mengulang kata di pertanyaan.";

/** Definisi kesulitan per level, supaya "tingkat setara 400/500/600" tidak hanya label. */
const LEVEL_RUBRIC = {
  low: "Tingkat RENDAH (skor sampai 450): kalimat pendek (sekitar 8-15 kata), kosakata sehari-hari, struktur dasar (tense sederhana, agreement, artikel, preposisi umum). Listening: tuturan lugas, satu ide per giliran, jawaban hampir langsung terucap. Reading: informasi tersurat, soal terutama ide utama dan detail. Distraktor salah dengan jelas bagi yang paham dasar.",
  mid: "Tingkat MENENGAH (skor 451-550): kalimat 15-25 kata, kosakata akademik umum, struktur menengah (klausa relatif, pasif, conditional, perbandingan). Listening: ada parafrase dan satu detail pengecoh. Reading: campuran detail dan inferensi ringan. Distraktor memakai kata dari teks tetapi salah makna atau detail.",
  high: "Tingkat TINGGI (skor di atas 550): kalimat 20-35 kata, kosakata akademik dan abstrak, struktur rumit (inversi, paralelisme, reduced clause, subjunctive, kata hubung kontras). Listening: makna tersirat, idiom, perubahan pendapat pembicara. Reading: banyak inferensi dan soal NOT/EXCEPT. Distraktor sangat mirip dan hanya beda tipis dari jawaban benar.",
} as const;
export const levelRubric = (level: number) => LEVEL_RUBRIC[levelBand(level)];

const BASE_SYSTEM = [
  "Kamu pembuat soal TOEFL ITP (paper-based, gaya ETS).",
  "Ikuti skenario/topik yang diminta di pesan pengguna supaya soal selalu bervariasi.",
  "Urutan opsi akan diacak, jadi jangan pakai opsi yang merujuk opsi lain (All of the above, Both A and B) dan jangan sebut huruf opsi di penjelasan; sebut isi opsinya.",
  OPTION_RULES,
  "Penjelasan jawaban SELALU dalam Bahasa Indonesia, ringkas dan jelas. Jangan pakai karakter em dash.",
  'Jangan tulis nomor soal di "q" (misalnya "Number 6." atau "3."); penomoran diatur aplikasi.',
  "Balas HANYA dengan objek JSON valid tanpa pagar kode dan tanpa teks lain.",
].join(" ");

const STRUCTURE_SYSTEM = [
  BASE_SYSTEM,
  "Buat soal Section 2 Structure (sentence completion): satu kalimat akademik formal dengan SATU bagian kosong (tandai ___), lalu 4 pilihan, tepat satu benar.",
  `Tiap soal wajib punya "skill": ${skillList("structure")}.`,
  '{"questions":[{"skill":"clause","q":"kalimat dengan ___","options":["A","B","C","D"],"answer":0,"explain_id":"alasan singkat"}]}',
].join(" ");

const WRITTEN_SYSTEM = [
  BASE_SYSTEM,
  "Buat soal Section 2 Written Expression: satu kalimat akademik formal yang mengandung TEPAT SATU kesalahan tata bahasa.",
  "Pecah kalimat menjadi bagian-bagian berurutan yang persis menyusun kalimat utuh (gabungan bagian = kalimat penuh, tanpa spasi tambahan).",
  'Empat bagian diberi label A, B, C, D berurutan; "options" berisi keempat potongan itu, dan "answer" adalah indeks (0-3) bagian yang SALAH.',
  `Tiap soal wajib punya "skill": ${skillList("structure")}.`,
  '{"questions":[{"type":"written","skill":"agreement","q":"kalimat utuh","options":["bagian A","bagian B","bagian C","bagian D"],"answer":2,"explain_id":"alasan singkat"}]}',
].join(" ");

const READING_SYSTEM = [
  BASE_SYSTEM,
  "Buat SATU passage akademik gaya TOEFL Section 3 (Reading), 250-320 kata, beberapa paragraf.",
  `Lalu buat soal pilihan ganda tentang passage itu. Tiap soal punya "skill": ${skillList("reading")}.`,
  '{"passage":"teks lengkap","questions":[{"skill":"main-idea","q":"pertanyaan","options":["A","B","C","D"],"answer":0,"explain_id":"alasan"}]}',
].join(" ");

const LISTENING_SYSTEM = [
  BASE_SYSTEM,
  "Buat soal TOEFL Section 1 Listening Part A: percakapan pendek kampus antara pria (man) dan wanita (woman), 2 giliran, lalu pertanyaan narator tentang maksud percakapan.",
  '{"questions":[{"skill":"listen-short","audio":[{"speaker":"man","text":"..."},{"speaker":"woman","text":"..."}],"q":"What does the woman mean?","options":["A","B","C","D"],"answer":0,"explain_id":"alasan"}]}',
].join(" ");

const LONG_DIALOGUE_SYSTEM = [
  BASE_SYSTEM,
  "Buat soal TOEFL Section 1 Listening Part B (long dialogue): percakapan kampus yang lebih panjang antara pria (man) dan wanita (woman), 6 sampai 10 giliran, satu topik akademik.",
  'Awali dengan satu baris "narrator" berisi pengantar, misalnya "Questions 31-33 are based on a dialogue between a man and a woman.".',
  'Lalu buat sejumlah soal pilihan ganda tentang dialog itu sesuai yang diminta di pesan pengguna (minimal 3 soal); tulis "audio" (transkrip lengkap) HANYA di soal pertama tiap dialog; soal berikutnya dari dialog yang sama TANPA field "audio" (otomatis memakai transkrip soal sebelumnya).',
  `Tiap soal wajib punya "skill": ${skillList("listening")}.`,
  '{"questions":[{"skill":"listen-long","audio":[{"speaker":"narrator","text":"Questions 31-33 are based on a dialogue between a man and a woman."},{"speaker":"man","text":"..."},{"speaker":"woman","text":"..."}],"q":"What are the speakers mainly discussing?","options":["A","B","C","D"],"answer":0,"explain_id":"alasan"},{"skill":"listen-long","q":"What does the man suggest?","options":["A","B","C","D"],"answer":2,"explain_id":"alasan"}]}',
].join(" ");

const LECTURE_SYSTEM = [
  BASE_SYSTEM,
  "Buat soal TOEFL Section 1 Listening Part C (lecture): satu monolog akademik dari seorang pembicara (speaker), 150 sampai 220 kata, gaya kuliah singkat.",
  'Awali dengan satu baris "narrator" berisi pengantar, misalnya "Questions 39-42 are based on a lecture.".',
  'Lalu buat sejumlah soal pilihan ganda tentang monolog itu sesuai yang diminta di pesan pengguna (minimal 3 soal); tulis "audio" (transkrip lengkap) HANYA di soal pertama tiap monolog; soal berikutnya dari monolog yang sama TANPA field "audio" (otomatis memakai transkrip soal sebelumnya).',
  `Tiap soal wajib punya "skill": ${skillList("listening")}.`,
  '{"questions":[{"skill":"listen-lecture","audio":[{"speaker":"narrator","text":"Questions 39-42 are based on a lecture."},{"speaker":"speaker","text":"..."}],"q":"What is the main idea of the lecture?","options":["A","B","C","D"],"answer":0,"explain_id":"alasan"},{"skill":"listen-lecture","q":"What example does the speaker give?","options":["A","B","C","D"],"answer":1,"explain_id":"alasan"}]}',
].join(" ");

// Gaya EPrT Telkom University, diambil dari "Contoh Soal EPrT" resmi.
const EPRT_BASE = [
  "Kamu pembuat soal EPrT (English Proficiency Test) Telkom University Language Center, format paper-based mirip TOEFL ITP.",
  "Bahasa soal jelas dan lugas tanpa jebakan idiom atau slang yang tidak adil; kerumitan struktur kalimat dan kosakata mengikuti rubrik tingkat di pesan pengguna (jangan disederhanakan di tingkat menengah dan tinggi).",
  "Posisi jawaban benar harus acak di antara A-D.",
  "Contoh yang diberikan hanya acuan gaya: JANGAN memakai nama, kalimat, atau topik dari contoh. Ikuti skenario/topik yang diminta di pesan pengguna.",
  "Urutan opsi akan diacak, jadi jangan pakai opsi yang merujuk opsi lain (All of the above, Both A and B) dan jangan sebut huruf opsi di penjelasan; sebut isi opsinya.",
  OPTION_RULES,
  "Penjelasan jawaban SELALU dalam Bahasa Indonesia, ringkas dan jelas. Jangan pakai karakter em dash.",
  'Jangan tulis nomor soal di "q" (misalnya "Number 6." atau "3."); penomoran diatur aplikasi.',
  "Balas HANYA dengan objek JSON valid tanpa pagar kode dan tanpa teks lain.",
].join(" ");

const EPRT_STRUCTURE_SYSTEM = [
  EPRT_BASE,
  "Buat soal Structure bagian Sentence Completion: satu kalimat lengkap bernuansa akademik/pengetahuan umum dengan SATU bagian kosong (tandai ___), 4 pilihan, tepat satu benar.",
  'Contoh gaya: "The ancient Greeks worshiped ___ gods within a culture that tolerated diversity." pilihan: many / a little / every / much (jawaban: many).',
  `Tiap soal wajib punya "skill": ${skillList("structure")}.`,
  '{"questions":[{"skill":"noun-pronoun","q":"kalimat dengan ___","options":["A","B","C","D"],"answer":1,"explain_id":"alasan singkat"}]}',
].join(" ");

const EPRT_WRITTEN_SYSTEM = [
  EPRT_BASE,
  "Buat soal Structure bagian Error Recognition: satu kalimat yang mengandung TEPAT SATU kesalahan tata bahasa pada salah satu dari empat bagian bergaris bawah.",
  'Contoh gaya: "Although numerous renovations and additions, the White House has retain its classically simple style." dengan bagian bergaris bawah numerous / has retain / its / classically, yang salah "has retain" (seharusnya has retained).',
  '"options" berisi empat potongan PERSIS seperti tertulis di kalimat, urut sesuai kemunculannya; "answer" adalah indeks (0-3) potongan yang SALAH.',
  `Tiap soal wajib punya "skill": ${skillList("structure")}.`,
  '{"questions":[{"type":"written","skill":"tense","q":"kalimat utuh","options":["bagian 1","bagian 2","bagian 3","bagian 4"],"answer":2,"explain_id":"alasan singkat"}]}',
].join(" ");

const EPRT_READING_SYSTEM = [
  EPRT_BASE,
  "Buat SATU teks Reading EPrT, 300-380 kata, 5-6 paragraf pendek, gaya artikel informatif sains populer, teknologi, bisnis, atau pengetahuan umum.",
  'Contoh gaya: artikel tentang glass fibers (cara dibuat, kegunaan di bangunan dan komunikasi, glass wool), dengan pertanyaan seperti "What was the author\'s main purpose in writing the article?".',
  "Kata yang ditanyakan pada soal kosakata atau rujukan (it, they, this) WAJIB ditebalkan di teks dengan **kata**, dan pertanyaannya menyebut kata itu, misalnya \"The word **fed** in paragraph 6 is closest in meaning to\".",
  `Lalu buat soal pilihan ganda campuran: tujuan/ide utama, detail, NOT/EXCEPT, kosakata, rujukan, inferensi. Tiap soal punya "skill": ${skillList("reading")}.`,
  '{"passage":"teks lengkap dengan **kata** ditebalkan","questions":[{"skill":"main-idea","q":"pertanyaan","options":["A","B","C","D"],"answer":1,"explain_id":"alasan"}]}',
].join(" ");

const EPRT_LISTENING_SYSTEM = [
  EPRT_BASE,
  "Buat soal Listening bagian Short Dialogue: percakapan singkat di kampus antara pria (man) dan wanita (woman), 2 giliran, misalnya mahasiswa dengan dosen, staf, atau teman.",
  'Pertanyaan narator lugas tentang tujuan, topik, atau detail, misalnya "Why does the man see the woman?", "What does the woman suggest?", "Where does the conversation probably take place?".',
  'Contoh: man: "Excuse me, Professor. Could you tell me who my lab partner is? My name is Mike Wheeler." woman: "Of course, Mike. Your lab partner is Parvati Sharma." q: "Why does the man see the woman?" jawaban: "To ask about his lab partner."',
  '{"questions":[{"skill":"listen-short","audio":[{"speaker":"man","text":"..."},{"speaker":"woman","text":"..."}],"q":"Why does the man see the woman?","options":["A","B","C","D"],"answer":2,"explain_id":"alasan"}]}',
].join(" ");

const EPRT_LONG_DIALOGUE_SYSTEM = [
  EPRT_BASE,
  "Buat soal Listening bagian Long Dialogue: percakapan antara pria (man) dan wanita (woman), 10 sampai 14 giliran pendek, situasi akademik, misalnya bimbingan skripsi dengan dosen, konsultasi tugas, atau urusan administrasi kampus.",
  'Awali dengan satu baris "narrator", misalnya "Questions 31-33 are based on a dialogue between a man and a woman.".',
  'Tiap dialog punya sejumlah soal sesuai yang diminta di pesan pengguna (minimal 3): topik yang dibicarakan ("What are the speakers discussing?"), masalah atau detail spesifik ("What specific challenge is the woman facing?"), dan saran atau pendapat pembicara ("What is the man\'s advice regarding ...?").',
  'Semua soal dari satu dialog memakai transkrip yang sama: tulis "audio" (transkrip lengkap) HANYA di soal pertama tiap dialog; soal berikutnya dari dialog yang sama TANPA field "audio" (otomatis memakai transkrip soal sebelumnya).',
  `Tiap soal wajib punya "skill": ${skillList("listening")}.`,
  '{"questions":[{"skill":"listen-long","audio":[{"speaker":"narrator","text":"Questions 31-33 are based on a dialogue between a man and a woman."},{"speaker":"woman","text":"..."},{"speaker":"man","text":"..."}],"q":"What are the speakers discussing?","options":["A","B","C","D"],"answer":3,"explain_id":"alasan"},{"skill":"listen-long","q":"What problem does the woman have?","options":["A","B","C","D"],"answer":0,"explain_id":"alasan"}]}',
].join(" ");

const EPRT_LECTURE_SYSTEM = [
  EPRT_BASE,
  "Buat soal Listening bagian Lecture: satu monolog dari seorang pembicara (speaker), 200 sampai 260 kata, misalnya sambutan klub mahasiswa, penjelasan dosen, atau pengumuman kampus tentang topik praktis (keuangan, kesehatan, teknologi, lingkungan, karier).",
  'Contoh gaya: "Welcome to the new members of this investment club. Today we will talk about the basics of investment..." berisi definisi, contoh, angka konkret (persentase, jumlah uang, tahun), lalu kesimpulan atau saran.',
  'Awali dengan satu baris "narrator", misalnya "Questions 41-45 are based on a talk.".',
  'Tiap monolog punya sejumlah soal sesuai yang diminta di pesan pengguna (minimal 4): definisi atau topik, contoh yang disebut, angka atau detail spesifik, dan saran penutup pembicara. Tulis "audio" (transkrip lengkap) HANYA di soal pertama tiap monolog; soal berikutnya dari monolog yang sama TANPA field "audio" (otomatis memakai transkrip soal sebelumnya).',
  `Tiap soal wajib punya "skill": ${skillList("listening")}.`,
  '{"questions":[{"skill":"listen-lecture","audio":[{"speaker":"narrator","text":"Questions 41-45 are based on a talk."},{"speaker":"speaker","text":"..."}],"q":"What is the definition of investing, as mentioned in the lecture?","options":["A","B","C","D"],"answer":0,"explain_id":"alasan"},{"skill":"listen-lecture","q":"What percentage does the speaker mention?","options":["A","B","C","D"],"answer":2,"explain_id":"alasan"}]}',
].join(" ");

function extractJson(raw: string) {
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? stripped).trim();
  const start = candidate.search(/[{[]/);
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (start < 0 || end <= start) return candidate;
  return candidate.slice(start, end + 1);
}

export function parseAiJson(raw: string): { passage?: unknown; questions?: unknown } {
  try {
    return JSON.parse(extractJson(raw)) as { passage?: unknown; questions?: unknown };
  } catch {
    return {};
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sanitizeQuestions(value: unknown, type: QuestionType, grouped = false): ToeflQuestion[] {
  if (!Array.isArray(value)) return [];
  // Dialog/monolog panjang: model menulis transkrip sekali di soal pertama,
  // soal berikutnya tanpa audio mewarisi transkrip soal sebelumnya.
  let lastAudio: AudioLine[] | null = null;
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const q = stripQuestionNumber(String(record.q ?? "")).slice(0, 700);
    const options = Array.isArray(record.options)
      ? record.options.slice(0, 4).map((option) => String(option).trim().slice(0, 300))
      : [];
    const answer = Number(record.answer);
    const audio =
      type === "listening" && Array.isArray(record.audio)
        ? record.audio.flatMap((line): AudioLine[] => {
            const item = (typeof line === "object" && line !== null ? line : {}) as Record<string, unknown>;
            const text = String(item.text ?? "").trim().slice(0, 2000);
            const speaker = item.speaker;
            return text && isSpeaker(speaker) ? [{ speaker, text }] : [];
          })
        : null;
    const ownAudio = audio && audio.length >= 2 ? audio : null;
    if (ownAudio) lastAudio = ownAudio;
    const lines = ownAudio ?? (grouped ? lastAudio : null);
    if (!q || options.length < 4 || options.some((option) => !option)) return [];
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return [];
    if (type === "listening" && !lines) return [];
    // Written Expression berisi potongan kalimat, jadi panjangnya tidak bisa diseragamkan.
    if (type !== "written" && longestAnswerGiveaway(options, answer)) return [];
    // Written Expression options must stay in sentence order; everything else is
    // shuffled so the correct answer is not always where the model put it.
    const order = type === "written" ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3]);
    return [
      {
        type,
        skill: isSkill(record.skill) ? record.skill : null,
        q,
        options: order.map((i) => options[i]),
        answer: order.indexOf(answer),
        explain_id: String(record.explain_id ?? "").slice(0, 600),
        ...(type === "listening" && lines ? { audio: lines } : {}),
      },
    ];
  });
}

type BuildKind = "structure" | "written" | "reading" | "listen-short" | "listen-long" | "listen-lecture";

export const BUILD_SYSTEM: Record<Track, Record<BuildKind, string>> = {
  toefl: {
    structure: STRUCTURE_SYSTEM,
    written: WRITTEN_SYSTEM,
    reading: READING_SYSTEM,
    "listen-short": LISTENING_SYSTEM,
    "listen-long": LONG_DIALOGUE_SYSTEM,
    "listen-lecture": LECTURE_SYSTEM,
  },
  eptr: {
    structure: EPRT_STRUCTURE_SYSTEM,
    written: EPRT_WRITTEN_SYSTEM,
    reading: EPRT_READING_SYSTEM,
    "listen-short": EPRT_LISTENING_SYSTEM,
    "listen-long": EPRT_LONG_DIALOGUE_SYSTEM,
    "listen-lecture": EPRT_LECTURE_SYSTEM,
  },
};

// ---------------------------------------------------------------------------
// Variasi soal: bank bersama, seed topik/skenario, dan saringan duplikat.

type Item = { passage: string | null; questions: ToeflQuestion[] };
type History = Awaited<ReturnType<typeof questionHistory>>;

const GROUPED: BuildKind[] = ["listen-long", "listen-lecture"];

function kindOfQuestion(question: ToeflQuestion): BuildKind {
  if (question.type === "listening") {
    return question.skill === "listen-long" || question.skill === "listen-lecture"
      ? question.skill
      : "listen-short";
  }
  return question.type;
}

/** Riwayat soal pengguna dari kedua track, untuk menyaring soal yang mirip. */
async function questionHistory(userId: number) {
  const rows = [
    ...(await listToeflSessions(userId, 40, "toefl")),
    ...(await listToeflSessions(userId, 40, "eptr")),
  ];
  const questions = new SimilarityIndex();
  const passages = new SimilarityIndex([], PASSAGE_SIMILAR);
  const stems = new Map<BuildKind, string[]>();
  for (const row of rows) {
    if (row.passage) passages.add(row.passage);
    for (const question of parseQuestions(row.questions)) {
      questions.add(questionText(question));
      const kind = kindOfQuestion(question);
      const list = stems.get(kind) ?? [];
      const firstLine = question.audio?.find((line) => line.speaker !== "narrator")?.text ?? "";
      if (list.length < 15) list.push(`${firstLine} ${question.q}`.trim().slice(0, 140));
      stems.set(kind, list);
    }
  }
  return { questions, passages, stems };
}

function reshuffle(question: ToeflQuestion): ToeflQuestion {
  if (question.type === "written") return question;
  const order = shuffle(question.options.map((_, index) => index));
  return {
    ...question,
    options: order.map((i) => question.options[i]),
    answer: order.indexOf(question.answer),
  };
}

type Request = {
  userId: number;
  track: Track;
  kind: BuildKind;
  count: number;
  level: number;
  focus: SkillKey[];
  first: number;
  note: string;
  /** Latihan satu topik: semua soal harus menguji skill `focus[0]`. */
  only?: boolean;
};

type Served = { block: Item; prints: string[] };

async function serveFromBank(request: Request, band: LevelBand, history: History): Promise<Served | null> {
  const { userId, track, kind, count, focus } = request;
  const single = kind !== "reading" && !GROUPED.includes(kind);
  const rows = await pickUnseenItems(
    userId,
    track,
    kind,
    band,
    single ? count * 3 : 12,
    request.only ? focus[0] : undefined,
  );
  const ordered = focus.length
    ? [...rows].sort(
        (a, b) =>
          Number(focus.includes(b.skill as SkillKey)) - Number(focus.includes(a.skill as SkillKey)),
      )
    : rows;

  // Kalibrasi: satu query untuk semua soal kandidat.
  const parsedRows = ordered.map((row) => {
    try {
      const stored = JSON.parse(row.item) as { passage?: unknown; questions?: unknown };
      return { row, stored, questions: parseQuestions(JSON.stringify(stored.questions ?? [])) };
    } catch {
      return null;
    }
  });
  const stats = await getQuestionStats(
    track,
    parsedRows.flatMap((parsed) => parsed?.questions.map((q) => fingerprint(questionText(q))) ?? []),
  );

  const chosen: { item: Item; print: string }[] = [];
  let total = 0;
  for (const parsed of parsedRows) {
    if (total >= count) break;
    if (!parsed) continue;
    const { row, stored, questions } = parsed;
    const passage = typeof stored.passage === "string" ? stored.passage : null;
    if (!questions.length) continue;
    // Soal yang terbukti bermasalah (hampir semua menjawab salah) atau terlalu mudah dilewati.
    const verdicts = questions.map((q) => judgeQuestion(stats.get(fingerprint(questionText(q))), band));
    if (verdicts.includes("faulty") || (single && verdicts.includes("too-easy"))) continue;
    if (kind === "reading") {
      if (!passage || questions.length < count || history.passages.has(passage)) continue;
    } else if (questions.some((question) => history.questions.has(questionText(question)))) {
      continue;
    }
    chosen.push({ item: { passage, questions }, print: row.fingerprint });
    total += questions.length;
    if (kind === "reading") break;
  }
  if (total < count) return null;

  const questions = chosen.flatMap(({ item }) => item.questions).slice(0, count).map(reshuffle);
  return {
    block: { passage: chosen[0].item.passage, questions: renumber(questions, request.first) },
    prints: chosen.map(({ print }) => print),
  };
}

/** Urutan band yang dicoba: band level pengguna dulu, lalu yang terdekat kalau stoknya kurang. */
const BAND_ORDER: Record<LevelBand, LevelBand[]> = {
  low: ["low", "mid", "high"],
  mid: ["mid", "low", "high"],
  high: ["high", "mid", "low"],
};

/**
 * Sumber soal untuk semua blok: bank soal yang dibuat admin (halaman Generate Konten), soal yang belum
 * pernah dilihat pengguna. Pembuatan soal oleh AI saat berlatih hanya aktif SEMENTARA lewat env
 * EPRT_AI_FALLBACK=1 (selagi stok bank masih tipis); matikan env itu untuk kembali bank-only.
 */
async function produceQuestions(request: Request): Promise<Item> {
  const history = await questionHistory(request.userId);
  const order = BAND_ORDER[levelBand(request.level)];
  const serve = async () => {
    for (const band of order) {
      const result = await serveFromBank(request, band, history);
      if (result) return result;
    }
    return null;
  };

  let result = await serve();
  if (!result && process.env.EPRT_AI_FALLBACK === "1" && request.track === "eptr") {
    await topUpFromAi(request);
    result = await serve();
  }
  if (!result) {
    throw new AiError("Stok soal untuk latihan ini belum tersedia. Coba lagi nanti; admin menambah soal baru secara berkala.");
  }
  await markSeen(request.userId, result.prints);
  return result.block;
}

/** Perkiraan soal lolos per batch pembuat bank, untuk menghitung berapa batch yang dibutuhkan. */
const SOAL_PER_BATCH: Record<BuildKind, number> = { structure: 6, written: 6, reading: 10, "listen-short": 6, "listen-long": 8, "listen-lecture": 8 };

/**
 * SEMENTARA (EPRT_AI_FALLBACK=1): stok bank kurang, jadi buat soal lewat pembuat bank yang sama dengan halaman admin
 * (rencana variasi + verifikasi model kedua + penyaring kualitas), simpan ke bank, lalu dilayani dari bank.
 * Dibatasi per pengguna supaya biaya AI tidak bisa dibakar dari sisi pelajar.
 * Setiap batch dihitung ke kuota AI harian (reserveBudget atomik) dan pemakaiannya
 * dicatat ke ai_usage — tanpa ini kill-switch anggaran tidak pernah melihat biaya
 * jalur termahal ini (audit keamanan P1).
 */
async function topUpFromAi(request: Request) {
  const config = await getAiConfig();
  if (!aiConfigured(config)) throw new AiError("Stok soal belum tersedia dan AI belum dikonfigurasi. Hubungi admin.");
  const limit = await checkRateLimit(`eptr-topup:user:${request.userId}`, 40, 60 * 60_000);
  if (!limit.ok) throw new AiError("Terlalu banyak permintaan pembuatan soal. Coba lagi sebentar lagi.");

  // Impor dinamis: eprt-generate memakai prompt dari berkas ini (hindari impor melingkar saat modul dimuat).
  const { createEprtContext, generateEprtBatch } = await import("@/lib/eprt-generate");
  setAiConcurrency(8);
  const band = levelBand(request.level);
  const ctx = await createEprtContext(config, undefined, { recent: 500, kinds: [request.kind] });
  const batches = Math.min(4, Math.ceil(request.count / SOAL_PER_BATCH[request.kind]) + 1);

  // Satu reservasi estimasi per batch; batch hanya dijalankan sebanyak reservasi
  // yang lolos gerbang anggaran. N request paralel tidak bisa bersama-sama
  // menembus batas harian karena syarat dievaluasi di statement INSERT.
  const reservations: number[] = [];
  for (let i = 0; i < batches; i += 1) {
    const id = await reserveBudget(request.userId, "eptr", config.model);
    if (!id) break;
    reservations.push(id);
  }
  if (!reservations.length) {
    throw new AiError("Kuota AI harian untuk pembuatan soal sudah habis. Coba lagi besok.");
  }

  const startedAt = Date.now();
  try {
    const results = await Promise.allSettled(
      Array.from({ length: reservations.length }, () => generateEprtBatch(ctx, request.kind, band)),
    );
    // ctx.usage menjumlahkan seluruh panggilan provider (buat + verifikasi + saring)
    // lintas batch; dicatat sekali sebagai belanja nyata hari ini.
    await logAiUsage({
      userId: request.userId,
      feature: "eptr",
      model: config.model,
      usage: ctx.usage,
      latencyMs: Date.now() - startedAt,
      ok: results.some((r) => r.status === "fulfilled"),
    });
  } catch (error) {
    await logAiUsage({
      userId: request.userId,
      feature: "eptr",
      model: config.model,
      usage: ctx.usage,
      latencyMs: Date.now() - startedAt,
      ok: false,
    }).catch(() => undefined);
    throw error;
  } finally {
    // Lepas reservasi estimasi: total bersih harian kembali tepat.
    await Promise.allSettled(reservations.map((id) => releaseReservation(id)));
  }
}

const BLOCK_CONFIG: Record<
  Exclude<BlockKind, "review">,
  { kind: BuildKind; count: number; section: ToeflSection; title: string }
> = {
  drill: { kind: "structure", count: 10, section: "structure", title: "Latihan Structure" },
  written: { kind: "written", count: 10, section: "structure", title: "Error Recognition" },
  reading: { kind: "reading", count: 10, section: "reading", title: "Latihan Reading" },
  listening: { kind: "listen-short", count: 10, section: "listening", title: "Listening: Percakapan Pendek" },
  "listening-15": { kind: "listen-short", count: 15, section: "listening", title: "Listening: Percakapan Pendek (15 soal)" },
  "listen-long": { kind: "listen-long", count: 8, section: "listening", title: "Listening: Percakapan Panjang" },
  "listen-lecture": { kind: "listen-lecture", count: 8, section: "listening", title: "Listening: Monolog" },
};

/**
 * Satu batch kecil dari sebuah bagian simulasi; nomor soal mengikuti lembar
 * soal asli. Dipanggil dari route handler per batch supaya tiap permintaan
 * pendek, lalu hasilnya disatukan ke satu sesi. `first` adalah nomor soal
 * pertama batch ini di lembar soal asli.
 */
export async function buildSimulationPartBatch(
  userId: number,
  kind: BuildKind,
  count: number,
  first: number,
) {
  const target = await getTrackTarget(userId, "eptr");
  const level = target?.score ?? DEFAULT_LEVEL;
  const listening = kind.startsWith("listen");
  const note = listening
    ? `Ini bagian dari tes lengkap: nomor soal dimulai dari ${first}, pakai nomor ini di pengantar narator.`
    : "";
  return produceQuestions({ userId, track: "eptr", kind, count, level, focus: [], first, note });
}

/**
 * `skill` (opsional) mengunci latihan Structure/Reading ke satu topik atau tipe
 * soal. Di Structure semua soal menguji topik itu; di Reading teks tetap campuran
 * tapi sebagian besar soal bertipe itu.
 */
export async function startBlock(
  userId: number,
  kind: BlockKind,
  track: Track = "toefl",
  skill?: SkillKey,
): Promise<number> {
  if (kind === "review") return startReview(userId, track);

  const target = await getTrackTarget(userId, track);
  const level = target?.score ?? DEFAULT_LEVEL;
  const { section, title } = BLOCK_CONFIG[kind];

  const topic = skill && section !== "listening" && SKILLS[skill].section === section ? skill : null;
  const sessions = await loadSessionAnswers(userId, track);
  const focus = topic
    ? [topic]
    : section === "structure" || section === "reading"
      ? focusSkills(collectAnswers(sessions), section)
      : [];

  const block = await produceQuestions({
    userId,
    track,
    kind: BLOCK_CONFIG[kind].kind,
    count: BLOCK_CONFIG[kind].count,
    level,
    focus,
    first: 1,
    note: "",
    only: topic !== null && section === "structure",
  });

  const labels = focus.map((key) => SKILLS[key].label).join(", ");
  await warmTts(block.questions);

  const row = await createToeflSession({
    userId,
    track,
    section,
    label: labels ? `${title} - ${labels}` : title,
    passage: block.passage,
    questions: JSON.stringify(block.questions),
    questionCount: block.questions.length,
  });
  return row.id;
}

async function startReview(userId: number, track: Track): Promise<number> {
  const due = await listDueReviews(userId, todayISO(), 15);
  const questions = due.flatMap((row) => {
    const parsed = parseQuestions(row.question);
    return parsed.map((question) => ({ ...question, reviewId: row.id }));
  });
  if (!questions.length) throw new AiError("Belum ada soal yang perlu diulang hari ini.");

  const row = await createToeflSession({
    userId,
    track,
    section: "review",
    label: `Ulang kesalahan (${questions.length} soal)`,
    passage: null,
    questions: JSON.stringify(questions),
    questionCount: questions.length,
  });
  return row.id;
}

async function loadSessionAnswers(userId: number, track: Track = "toefl") {
  const rows = await listToeflSessions(userId, 30, track);
  return rows.map((row) => {
    const questions = parseQuestions(row.questions);
    return {
      section: row.section,
      questions,
      answers: parseAnswers(row.answers, questions.length),
    };
  });
}

/**
 * Timpa satu slot jawaban untuk sesi non-audio (koreksi jawaban di mode ujian).
 * Berbeda dari `setSessionAnswer`, slot yang sudah terisi boleh ditimpa selama
 * sesi belum ditutup (completedAt masih null) — setelah selesai, jawaban final.
 * Mengembalikan isi kolom answers terbaru, null kalau sesi sudah ditutup di
 * antara baca dan tulis.
 */
async function overwriteSessionAnswer(id: number, index: number, choice: number) {
  const path = `$[${index}]`;
  const [row] = await db
    .update(toeflSessions)
    .set({ answers: sql`json_set(${toeflSessions.answers}, ${path}, ${choice})` })
    .where(and(eq(toeflSessions.id, id), isNull(toeflSessions.completedAt)))
    .returning({ answers: toeflSessions.answers });
  return row ?? null;
}

export async function answerQuestion(
  userId: number,
  sessionId: number,
  index: number,
  choice: number,
) {
  const row = await getToeflSession(userId, sessionId);
  if (!row) throw new AiError("Sesi tidak ditemukan.");

  const questions = parseQuestions(row.questions);
  const question = questions[index];
  if (!question) throw new AiError("Soal tidak ditemukan.");
  if (choice < 0 || choice >= question.options.length) throw new AiError("Jawaban tidak valid.");
  if (row.completedAt) throw new AiError("Bagian ini sudah ditutup.");
  if (row.simulationId && row.section !== "review") {
    const sim = await getSimulation(userId, row.simulationId);
    if (sim && isExpired(parseTimers(sim.timers), row.section)) {
      throw new AiError("Waktu section ini sudah habis.");
    }
  }

  // Sesi audio mengikuti aturan tes asli: urutan putar terkunci, slot yang
  // sudah terisi tidak boleh diubah. Sesi non-audio boleh mengoreksi jawaban
  // selama section belum ditutup.
  const audioSession = questions.some((item) => Boolean(item.audio));
  const previous = parseAnswers(row.answers, questions.length)[index];

  // Klaim slot jawaban secara atomik (json_set per slot): pengiriman paralel
  // dari antrean offline tidak lagi saling menimpa jawaban satu sama lain.
  // Slot kosong diklaim; slot terisi di sesi non-audio ditimpa terkontrol.
  const updated =
    previous !== null && !audioSession
      ? await overwriteSessionAnswer(row.id, index, choice)
      : await setSessionAnswer(row.id, index, choice);
  if (!updated) {
    // Slot tidak terisi: sudah terisi oleh kiriman lain, atau sesi baru saja
    // ditutup. Baca ulang dan perlakukan jawaban duplikat sebagai benign.
    const fresh = await getToeflSession(userId, sessionId);
    if (!fresh) throw new AiError("Sesi tidak ditemukan.");
    return isComplete(parseAnswers(fresh.answers, questions.length));
  }

  // Review dan kalibrasi hanya dicatat dari pengisian PERTAMA supaya koreksi
  // jawaban tidak mendobel statistik; skor akhir dihitung sekali saat finish.
  if (previous === null) {
    await recordResult(userId, question, choice);
    await recordCalibration(userId, row.track, question, choice);
  }
  return isComplete(parseAnswers(updated.answers, questions.length));
}

/**
 * Catat hasil jawaban untuk kalibrasi kesulitan. Soal ulangan (review) tidak
 * dihitung karena sudah pernah dilihat. Gagal mencatat tidak boleh menggagalkan jawaban.
 */
async function recordCalibration(
  userId: number,
  track: Track,
  question: ToeflQuestion,
  choice: number,
) {
  if (question.reviewId) return;
  try {
    const target = await getTrackTarget(userId, track);
    await recordAnswerStat({
      fingerprint: fingerprint(questionText(question)),
      track,
      kind: kindOfQuestion(question),
      skill: question.skill,
      levelBand: levelBand(target?.score ?? DEFAULT_LEVEL),
      correct: choice === question.answer,
    });
  } catch (error) {
    console.error("[calibration] gagal mencatat:", error);
  }
}

async function recordResult(userId: number, question: ToeflQuestion, choice: number) {
  const today = todayISO();
  const correct = choice === question.answer;

  if (question.reviewId) {
    const review = await getReview(userId, question.reviewId);
    if (!review) return;
    if (correct && review.box === MAX_REVIEW_BOX) await deleteReview(review.id);
    else await updateReview(review.id, nextReview(review.box, correct, today));
    return;
  }

  if (!correct) {
    // Soal yang sama boleh punya satu review aktif saja: kalau sudah ada,
    // cukup reset jadwalnya ke hari ini, jangan buat baris baru.
    const existing = await findActiveReview(userId, fingerprint(questionText(question)));
    if (existing) {
      // Jawaban salah selalu mengulang dari box 0, walau review-nya sudah
      // jatuh tempo hari ini (sebelumnya box tidak di-reset dalam kasus itu).
      if (existing.box !== 0 || existing.dueAt !== today)
        await updateReview(existing.id, { box: 0, dueAt: today });
      return;
    }
    try {
      await createReview({
        userId,
        question: JSON.stringify(question),
        fingerprint: fingerprint(questionText(question)),
        ...nextReview(0, false, today),
      });
    } catch (error) {
      // Dua jawaban salah paralel bisa sama-sama lolos findActiveReview;
      // unique index menolak yang kedua. Perlakukan seperti "sudah ada".
      if (!(error instanceof Error) || !/UNIQUE/i.test(error.message)) throw error;
    }
  }
}

export async function finishSession(userId: number, sessionId: number) {
  const row = await getToeflSession(userId, sessionId);
  if (!row) throw new AiError("Sesi tidak ditemukan.");

  const questions = parseQuestions(row.questions);
  const answers = parseAnswers(row.answers, questions.length).map((answer) => answer ?? -1);
  const complete = isComplete(answers);
  const score = complete
    ? scaledScore(
        // Review memakai konversi structure karena soalnya berasal dari
        // latihan Structure/Reading tanpa informasi asal section.
        row.section === "review" || row.section === "structure" ? "structure" : row.section,
        questions.filter((question, index) => answers[index] === question.answer).length /
          Math.max(1, questions.length),
      )
    : null;

  await updateToeflSession(row.id, {
    answers: JSON.stringify(answers),
    completedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    score,
  });

  if (complete) await logActivity(userId, "toefl", row.label);
  await refreshTrend(userId, row.track);
  return complete;
}

async function refreshTrend(userId: number, track: Track = "toefl") {
  const sessions = await loadSessionAnswers(userId, track);
  const estimate = estimateScore(collectAnswers(sessions));
  if (!estimate) return;

  const today = todayISO();
  const trend = await getTrackTrend(userId, track);
  await setSetting(userId, TRACK_SETTINGS[track].trend, [
    ...trend.filter((point) => point.date !== today),
    { date: today, total: estimate.total },
  ].slice(-TREND_DAYS));
}

export type SessionView = {
  id: number;
  section: string;
  label: string;
  passage: string | null;
  questions: ToeflQuestion[];
  answers: (number | null)[];
  completedAt: string | null;
  score: number | null;
};

export async function loadSession(userId: number, id: number): Promise<SessionView | null> {
  const row = await getToeflSession(userId, id);
  if (!row) return null;
  const questions = parseQuestions(row.questions);
  return {
    id: row.id,
    section: row.section,
    label: row.label,
    passage: row.passage,
    questions,
    answers: parseAnswers(row.answers, questions.length),
    completedAt: row.completedAt,
    score: row.score,
  };
}

export async function toeflOverview(userId: number, today: string, track: Track = "toefl") {
  const [rows, target, reviews, trend] = await Promise.all([
    listToeflSessions(userId, 30, track),
    getTrackTarget(userId, track),
    countReviews(userId, today),
    getTrackTrend(userId, track),
  ]);

  const sessions = rows.map((row) => {
    const questions = parseQuestions(row.questions);
    return {
      id: row.id,
      section: row.section,
      label: row.label,
      createdAt: row.createdAt,
      completed: Boolean(row.completedAt),
      score: row.score,
      simulation: row.simulationId !== null,
      questions,
      answers: parseAnswers(row.answers, questions.length),
    };
  });

  const answers = collectAnswers(sessions);
  const recent = sessions.filter((session) => !session.simulation).slice(0, 12);
  const activity = await listActivity(userId, 200);

  return {
    target,
    reviews,
    trend,
    estimate: estimateScore(answers),
    stats: skillStats(answers),
    streak: streakDays(activity.map((entry) => entry.date), today),
    // Tujuh hari terakhir (hari ini paling kanan), untuk strip streak.
    week: Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(today, index - 6);
      return { date, active: activity.some((entry) => entry.date === date) };
    }),
    history: recent.map((session) => ({
      id: session.id,
      label: session.label,
      score: session.score,
      completed: session.completed,
    })),
  };
}
