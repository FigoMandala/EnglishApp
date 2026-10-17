import { warmTts } from "@/lib/api/tts";
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
  getSetting,
  setSetting,
  SETTING_KEYS,
} from "@/db/queries/activity";
import { countQuestionCallsToday, logAiUsage, type AiFeature } from "@/db/queries/ai-usage";
import {
  getQuestionStats,
  levelBand,
  markSeen,
  pickUnseenItems,
  recordAnswerStat,
  saveBankItems,
  type LevelBand,
} from "@/db/queries/question-bank";
import { judgeQuestion } from "@/lib/calibration";
import { chatJsonRaw, AiError, type ProviderMessage } from "@/lib/ai-client";
import { checkBudget } from "@/lib/ai-budget";
import { EMPTY_USAGE } from "@/lib/ai-pricing";
import { aiConfigured, getAiConfig, type AiConfig } from "@/lib/ai-config";
import { isExpired, parseTimers } from "@/lib/eprt-simulation";
import {
  copiesExample,
  fingerprint,
PASSAGE_SIMILAR,
  pickFresh,
  pickScenes,
  questionText,
  readingAngle,
  rememberSeeds,
  SimilarityIndex,
  SUBTOPICS,
  talkStyle,
} from "@/lib/question-variety";
import { MAX_REVIEW_BOX, nextReview, shiftDate, streakDays, todayISO } from "@/lib/srs";
import {
  collectAnswers,
  dialogueKey,
  estimateScore,
  focusSkills,
  isComplete,
  isSkill,
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

// Cadangan kecil saja: tiap soal tambahan memperpanjang output (dan waktu tunggu) model.
const SPARE_QUESTIONS = 2;
/** Batas panggilan AI pembuat soal per pengguna per hari. Satu simulasi mode cepat bisa memakai ~11-22 panggilan. */
export const DAILY_AI_LIMIT = 80;
/** Porsi blok yang tetap dibuat baru oleh AI walau bank punya stok, supaya bank tidak basi. */
const FRESH_RATIO = 0.3;
/** Anggaran waktu total satu pembuatan soal, di bawah maxDuration 300 detik Vercel. */
const GENERATION_BUDGET_MS = 270_000;
/** Coba ulang hanya kalau sisa anggaran masih cukup untuk satu panggilan lagi. */
const MIN_RETRY_MS = 20_000;
const DEFAULT_LEVEL = 500;
const TREND_DAYS = 30;

function skillList(section: ToeflSection) {
  return Object.entries(SKILLS)
    .filter(([, skill]) => skill.section === section)
    .map(([key, skill]) => `${key} = ${skill.hint}`)
    .join("; ");
}

const BASE_SYSTEM = [
  "Kamu pembuat soal TOEFL ITP (paper-based, gaya ETS).",
  "Ikuti skenario/topik yang diminta di pesan pengguna supaya soal selalu bervariasi.",
  "Urutan opsi akan diacak, jadi jangan pakai opsi yang merujuk opsi lain (All of the above, Both A and B) dan jangan sebut huruf opsi di penjelasan; sebut isi opsinya.",
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
  "Bahasa soal sederhana dan lugas: pertanyaan menguji pemahaman langsung (tujuan, topik, detail, angka), bukan jebakan idiom yang rumit.",
  "Posisi jawaban benar harus acak di antara A-D.",
  "Contoh yang diberikan hanya acuan gaya: JANGAN memakai nama, kalimat, atau topik dari contoh. Ikuti skenario/topik yang diminta di pesan pengguna.",
  "Urutan opsi akan diacak, jadi jangan pakai opsi yang merujuk opsi lain (All of the above, Both A and B) dan jangan sebut huruf opsi di penjelasan; sebut isi opsinya.",
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

function parseAiJson(raw: string): { passage?: unknown; questions?: unknown } {
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

function sanitizeQuestions(value: unknown, type: QuestionType, grouped = false): ToeflQuestion[] {
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

async function ask(config: AiConfig, system: string, prompt: string, ctx: UsageContext, deadline: number) {
  const startedAt = Date.now();

  // Kill-switch anggaran: hentikan generate kalau biaya harian lewat batas.
  const budget = await checkBudget();
  if (!budget.allowed) {
    throw new AiError("Kuota AI harian habis. Coba lagi besok, atau hubungi admin.");
  }

  let totalLatency = 0;
  let lastRaw = "";
  const messages: ProviderMessage[] = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];

  try {
    // JSON mode + 1x retry perbaikan: menekan output malformed.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const left = deadline - Date.now();
      if (attempt > 0 && left < MIN_RETRY_MS) break;
      const result = await chatJsonRaw(config, messages, left);
      totalLatency += result.latencyMs;
      lastRaw = result.content;
      const parsed = parseAiJson(result.content);
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        await logAiUsage({
          userId: ctx.userId,
          feature: ctx.feature,
          model: config.model,
          usage: result.usage,
          latencyMs: totalLatency,
          ok: true,
        });
        return parsed;
      }
      messages.push({
        role: "user",
        content: "Output sebelumnya bukan JSON valid atau tidak punya array `questions`. Kirim ulang JSON yang benar saja.",
      });
    }

    await logAiUsage({
      userId: ctx.userId,
      feature: ctx.feature,
      model: config.model,
      usage: EMPTY_USAGE,
      latencyMs: totalLatency,
      ok: false,
    });
    console.error(`[ai] soal tidak valid: ${lastRaw.slice(0, 160)}`);
    throw new AiError("Model AI tidak menghasilkan soal yang bisa dibaca. Coba lagi.");
  } catch (error) {
    if (!(error instanceof AiError)) {
      await logAiUsage({
        userId: ctx.userId,
        feature: ctx.feature,
        model: config.model,
        usage: EMPTY_USAGE,
        latencyMs: Date.now() - startedAt,
        ok: false,
      });
    }
    throw error;
  }
}

function skillLine(count: number, focus: SkillKey[], only: boolean) {
  if (only && focus.length) return `Semua soal menguji skill ${focus[0]}.`;
  if (focus.length) {
    return `Minimal ${Math.ceil(count * 0.7)} soal menguji skill ${focus.join(" dan ")}, sisanya skill lain.`;
  }
  return "Sebar soal merata ke semua skill.";
}

type BuildKind = "structure" | "written" | "reading" | "listen-short" | "listen-long" | "listen-lecture";

type UsageContext = { userId: number; feature: AiFeature };

const BUILD_SYSTEM: Record<Track, Record<BuildKind, string>> = {
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

const TEST_NAME: Record<Track, string> = { toefl: "TOEFL ITP", eptr: "EPrT (skala mirip TOEFL ITP)" };

function questionTypeOf(kind: BuildKind): QuestionType {
  if (kind === "reading") return "reading";
  if (kind === "written") return "written";
  if (kind === "structure") return "structure";
  return "listening";
}

/** Satu panggilan AI; hasilnya belum disaring. */
async function buildQuestions(
  config: AiConfig,
  kind: BuildKind,
  count: number,
  level: number,
  focus: SkillKey[],
  ctx: UsageContext,
  track: Track,
  extra: string,
  deadline: number,
  only = false,
): Promise<Item> {
  const system = BUILD_SYSTEM[track][kind];
  const test = TEST_NAME[track];
  const talks = track === "eptr" ? 2 : 3;
  const total = count + SPARE_QUESTIONS;
  const perTalk = Math.max(2, Math.ceil(Math.max(count, SPARE_QUESTIONS) / talks));
  const prompt =
    kind === "listen-long"
      ? `Buat ${talks} dialog panjang berbeda, masing-masing dengan ${perTalk} soal (total minimal ${count} soal), tingkat setara ${test} ${level}.`
      : kind === "listen-lecture"
        ? `Buat ${talks} monolog berbeda, masing-masing dengan ${perTalk} soal (total minimal ${count} soal), tingkat setara ${test} ${level}.`
        : kind === "listen-short"
          ? `Buat ${total} soal, tingkat setara ${test} ${level}.`
          : `Buat ${total} soal, tingkat setara ${test} ${level}. ${skillLine(count, focus, only)}`;

  const parsed = await ask(config, system, `${prompt}\n${extra}`.trim(), ctx, deadline);
  const passage = typeof parsed.passage === "string" ? parsed.passage.trim() : "";
  return {
    passage: kind === "reading" && passage ? passage : null,
    questions: sanitizeQuestions(parsed.questions, questionTypeOf(kind), GROUPED.includes(kind)),
  };
}

// ---------------------------------------------------------------------------
// Variasi soal: bank bersama, seed topik/skenario, dan saringan duplikat.

type SeedMemory = { topics: string[]; scenes: string[] };
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

function itemFingerprint(kind: BuildKind, item: Item) {
  if (item.passage) return fingerprint(item.passage);
  if (GROUPED.includes(kind)) {
    return fingerprint((item.questions[0]?.audio ?? []).map((line) => line.text).join(" "));
  }
  return fingerprint(questionText(item.questions[0]));
}

/** Pecah hasil menjadi item bank: per soal, per teks, atau per dialog/monolog. */
function toItems(kind: BuildKind, block: Item): Item[] {
  if (kind === "reading") return block.passage ? [block] : [];
  if (!GROUPED.includes(kind)) {
    return block.questions.map((question) => ({ passage: null, questions: [question] }));
  }
  const groups = new Map<string, ToeflQuestion[]>();
  for (const question of block.questions) {
    const key = dialogueKey(question);
    groups.set(key, [...(groups.get(key) ?? []), question]);
  }
  return [...groups.values()].map((questions) => ({ passage: null, questions }));
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
  /** Lewati bank soal; dipakai kalau bank tidak bisa disaring sesuai permintaan. */
  forceFresh?: boolean;
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

/** Seed topik/skenario untuk satu panggilan AI, plus daftar soal yang harus dihindari. */
function varietyPrompt(request: Request, memory: SeedMemory, avoid: string[]) {
  const { kind } = request;
  const n = request.count + SPARE_QUESTIONS;
  const talks = request.track === "eptr" ? 2 : 3;
  const perTalk = Math.max(2, Math.ceil(request.count / talks));
  let topics: string[] = [];
  let scenes: string[] = [];
  let line: string;

  if (kind === "reading") {
    topics = pickFresh(SUBTOPICS, memory.topics, 1);
    line = `Topik teks: "${topics[0]}". Sudut pembahasan: ${readingAngle()}.`;
  } else if (kind === "listen-lecture") {
    topics = pickFresh(SUBTOPICS, memory.topics, talks);
    line = `Buat tepat ${talks} monolog, masing-masing dengan ${perTalk} soal. Topik tiap monolog (urut): ${topics.map((topic, i) => `${i + 1}. ${talkStyle()} about ${topic}`).join("; ")}.`;
  } else if (kind === "listen-long") {
    scenes = pickScenes(memory.scenes, talks);
    line = `Buat tepat ${talks} dialog, masing-masing dengan ${perTalk} soal. Skenario tiap dialog (urut): ${scenes.map((scene, i) => `${i + 1}. ${scene}`).join("; ")}.`;
  } else if (kind === "listen-short") {
    scenes = pickScenes(memory.scenes, n);
    line = `Skenario tiap soal (urut, satu skenario per soal): ${scenes.map((scene, i) => `${i + 1}. ${scene}`).join("; ")}.`;
  } else {
    topics = pickFresh(SUBTOPICS, memory.topics, n);
    line = `Konteks kalimat tiap soal (urut, satu konteks per soal): ${topics.map((topic, i) => `${i + 1}. ${topic}`).join("; ")}.`;
  }

  const avoidLine = avoid.length
    ? `Pengguna sudah pernah mendapat soal berikut; JANGAN buat yang mirip:\n- ${avoid.join("\n- ")}`
    : "";
  return { text: [line, request.note, avoidLine].filter(Boolean).join("\n"), topics, scenes };
}

async function generateFresh(
  request: Request,
  band: LevelBand,
  history: History,
  config: AiConfig,
  startedAt: number,
): Promise<Served> {
  const { userId, track, kind, count, level, focus } = request;
  const ctx: UsageContext = { userId, feature: track === "eptr" ? "eptr" : "toefl" };
  const memory = await getSetting<SeedMemory>(userId, SETTING_KEYS.questionSeeds, {
    topics: [],
    scenes: [],
  });
  const avoid = history.stems.get(kind) ?? [];
  const deadline = startedAt + GENERATION_BUDGET_MS;

  const batch = new SimilarityIndex();
  const kept: ToeflQuestion[] = [];
  const used: SeedMemory = { topics: [], scenes: [] };
  let passage: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const variety = varietyPrompt(
      request,
      { topics: [...memory.topics, ...used.topics], scenes: [...memory.scenes, ...used.scenes] },
      avoid,
    );
    used.topics.push(...variety.topics);
    used.scenes.push(...variety.scenes);

    let result: Item;
    try {
      result = await buildQuestions(
        config,
        kind,
        count,
        level,
        focus,
        ctx,
        track,
        variety.text,
        deadline,
        request.only,
      );
    } catch (error) {
      // Percobaan ulang yang gagal/timeout tidak boleh membuang hasil percobaan pertama.
      if (attempt === 0 || !(error instanceof AiError)) throw error;
      break;
    }
    const passageOk =
      kind !== "reading" ||
      (result.passage !== null &&
        !copiesExample(result.passage) &&
        !history.passages.has(result.passage));

    if (passageOk) {
      // Soal Reading terikat pada teksnya: teks baru berarti mulai dari nol.
      if (kind === "reading") {
        passage = result.passage;
        kept.length = 0;
        batch.clear();
      }
      // Soal yang berbagi satu dialog/monolog (listen-long/lecture) tidak boleh
      // dinilai per transkrip: AI menyalin transkrip dialog yang sama dengan
      // variasi kecil, dan semua soal dalam satu dialog memang mirip. Cukup
      // cegah pertanyaan kembar, dan cek dialog baru terhadap riwayat lewat q.
      const grouped = GROUPED.includes(kind);
      const seenQuestions = new Set<string>();
      for (const question of result.questions) {
        const text = questionText(question);
        const key = grouped ? question.q : text;
        const seenBefore = kind !== "reading" && history.questions.has(text);
        const drop = copiesExample(text) || seenBefore || seenQuestions.has(key) || batch.has(key);
        if (drop) continue;
        seenQuestions.add(key);
        batch.add(key);
        kept.push(question);
      }
    }

    if ((kind !== "reading" || passage) && kept.length >= count) break;
    const retryable =
      deadline - Date.now() >= MIN_RETRY_MS &&
      (await countQuestionCallsToday(userId)) < DAILY_AI_LIMIT;
    if (!retryable) break;
  }

  if ((kind === "reading" && !passage) || kept.length < Math.min(4, count)) {
    throw new AiError("Soal dari AI tidak bisa dibaca. Coba lagi sebentar lagi.");
  }

  // Semua soal yang lolos (termasuk cadangan) masuk bank; yang disajikan hanya `count`.
  await saveBankItems(
    toItems(kind, { passage, questions: kept }).map((item) => ({
      track,
      kind,
      levelBand: band,
      fingerprint: itemFingerprint(kind, item),
      skill: item.questions[0]?.skill ?? null,
      questionCount: item.questions.length,
      item: JSON.stringify(item),
    })),
  );
  await setSetting(userId, SETTING_KEYS.questionSeeds, {
    topics: rememberSeeds(memory.topics, used.topics),
    scenes: rememberSeeds(memory.scenes, used.scenes),
  });

  const served = kept.slice(0, count);
  return {
    block: { passage, questions: renumber(served, request.first) },
    prints: toItems(kind, { passage, questions: served }).map((item) => itemFingerprint(kind, item)),
  };
}

/**
 * Sumber soal untuk semua blok: bank bersama dulu (soal yang belum pernah dilihat
 * pengguna), AI kalau stok kurang atau untuk porsi soal segar.
 */
async function produceQuestions(request: Request): Promise<Item> {
  const startedAt = Date.now();
  const band = levelBand(request.level);
  const history = await questionHistory(request.userId);
  const config = await getAiConfig();
  const aiReady = aiConfigured(config);
  const aiAllowed =
    aiReady && (await countQuestionCallsToday(request.userId)) < DAILY_AI_LIMIT;

  const wantFresh = aiAllowed && (request.forceFresh || Math.random() < FRESH_RATIO);
  let result = wantFresh ? null : await serveFromBank(request, band, history);
  if (!result) {
    if (!aiReady) throw new AiError("Tutor AI belum dikonfigurasi. Isi API key di Pengaturan.");
    if (!aiAllowed) {
      throw new AiError(
        `Batas ${DAILY_AI_LIMIT} pembuatan soal AI hari ini sudah tercapai dan stok bank soal untuk latihan ini habis. Coba lagi besok.`,
      );
    }
    result = await generateFresh(request, band, history, config, startedAt);
  }
  await markSeen(request.userId, result.prints);
  return result.block;
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
    // Bank reading disimpan per teks, tidak bisa disaring per tipe soal.
    forceFresh: topic !== null && section === "reading",
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

export async function answerQuestion(
  userId: number,
  sessionId: number,
  index: number,
  choice: number,
) {
  const row = await getToeflSession(userId, sessionId);
  if (!row) throw new AiError("Sesi tidak ditemukan.");

  const questions = parseQuestions(row.questions);
  const answers = parseAnswers(row.answers, questions.length);
  const question = questions[index];
  if (!question) throw new AiError("Soal tidak ditemukan.");
  if (choice < 0 || choice >= question.options.length) throw new AiError("Jawaban tidak valid.");
  if (answers[index] !== null) return isComplete(answers);
  if (row.completedAt) throw new AiError("Bagian ini sudah ditutup.");
  if (row.simulationId && row.section !== "review") {
    const sim = await getSimulation(userId, row.simulationId);
    if (sim && isExpired(parseTimers(sim.timers), row.section)) {
      throw new AiError("Waktu section ini sudah habis.");
    }
  }

  answers[index] = choice;
  await recordResult(userId, question, choice);
  await recordCalibration(userId, row.track, question, choice);
  await updateToeflSession(row.id, { answers: JSON.stringify(answers) });
  return isComplete(answers);
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
    await createReview({
      userId,
      question: JSON.stringify(question),
      ...nextReview(0, false, today),
    });
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
