import { and, asc, desc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { questionBank } from "@/db/schema";
import { saveBankItems, type LevelBand } from "@/db/queries/question-bank";
import { chatJsonRaw, type ProviderMessage } from "@/lib/ai-client";
import { reasoningExtra, type AiConfig } from "@/lib/ai-config";
import type { TokenUsage } from "@/lib/ai-pricing";
import { BUILD_SYSTEM, levelRubric, parseAiJson, sanitizeQuestions } from "@/lib/api/toefl-turn";
import {
  copiesExample,
  fingerprint,
  pickFresh,
  pickScenes,
  PASSAGE_SIMILAR,
  QUESTION_SIMILAR,
  questionText,
  readingAngle,
  rememberSeeds,
  SUBTOPICS,
  talkStyle,
} from "@/lib/question-variety";
import { NearDupIndex } from "@/lib/near-dup";
import { pickHooks, pickModifier, pickPoints, pickRegister } from "@/lib/seed-space";
import { dialogueKey, type QuestionType, type ToeflQuestion } from "@/lib/toefl";

/** Pembuat bank soal TOEFL ITP: dipakai halaman admin dan skrip src/db/generate-eprt-bank.ts. */
export type Kind = "structure" | "written" | "reading" | "listen-short" | "listen-long" | "listen-lecture";
export const KINDS: Kind[] = ["structure", "written", "reading", "listen-short", "listen-long", "listen-lecture"];
export const BANDS: LevelBand[] = ["low", "mid", "high"];

/** Dialog/monolog panjang berbagi satu naskah antar beberapa soal; satu item bank = satu naskah beserta soalnya. */
const GROUPED: Kind[] = ["listen-long", "listen-lecture"];
const isListening = (kind: Kind) => kind.startsWith("listen");
const questionType = (kind: Kind): QuestionType => (isListening(kind) ? "listening" : (kind as QuestionType));

/**
 * Item bank per panggilan (15 soal sekaligus kena timeout gateway ~75 dtk pada deepseek):
 * structure/written/listen-short = soal; reading = satu teks (12 soal, minimal 10 yang lolos);
 * listen-long/lecture = dua naskah, masing-masing 5 soal.
 */
export const PER_CALL: Record<Kind, number> = { structure: 6, written: 6, reading: 1, "listen-short": 6, "listen-long": 2, "listen-lecture": 2 };
const READING_QUESTIONS = 12;
const READING_MIN = 10;
const TALKS = 2;
const PER_TALK = 5;
const TALK_MIN_QUESTIONS = 3;

/** Standar kualitas setara ujian Cambridge/ETS, ditambahkan ke prompt pembuat soal. */
const QUALITY_COMMON =
  "STANDAR KUALITAS (setara ujian Cambridge/ETS): (1) tepat SATU jawaban yang bisa dipertahankan menurut bahasa Inggris formal baku; kalau opsi lain bisa diperdebatkan benar, tulis ulang soalnya. (2) Setiap distraktor mencerminkan kesalahan nyata pelajar (tense, agreement, word form, preposisi, paralelisme, kata hubung) dan salah karena SATU alasan yang jelas; dilarang distraktor yang asal tidak gramatikal (mis. \"have releasing\"), absurd, atau tidak nyambung. (3) Setiap soal dalam satu batch menguji titik tata bahasa/kemampuan yang BERBEDA. (4) Di level menengah dan tinggi jangan uji hal dasar (modal + bentuk dasar, agreement subjek-verba sederhana). (5) Panjang opsi benar harus bervariasi: pada sekitar tiga dari empat soal opsi benar BUKAN yang terpanjang (buat distraktor sama panjang atau lebih panjang). (6) DILARANG menguji: subjunctive/mandative setelah recommend, suggest, insist, demand (bahasa Inggris Britania menerima bentuk indikatif); agreement dengan kata benda yang tunggal atau jamak (means, series, species, data, media, criteria, staff, police); inversi setelah pola \"the more…, the less…\".";
const QUALITY_LISTENING =
  "STANDAR KUALITAS LISTENING (setara ujian Cambridge/ETS): (1) tepat SATU jawaban yang benar HANYA berdasarkan naskah; jangan perlu pengetahuan di luar naskah. (2) Naskah terdengar seperti tuturan nyata di kampus (kontraksi, penanda wacana seperti \"well\", \"actually\", \"so\", perubahan pikiran), bukan kalimat tertulis yang kaku; tiap giliran bicara singkat. (3) Jawaban benar berupa PARAFRASE isi naskah, bukan salinan kata-katanya; distraktor memakai kata dari naskah tetapi salah makna, salah detail, atau berlawanan. (4) Variasikan jenis soal: ide utama/tujuan, detail, inferensi (\"What does the woman imply?\", \"What will the man probably do next?\"), sikap pembicara. (5) Di level menengah dan tinggi sertakan minimal satu soal inferensi atau maksud tersirat per naskah. (6) Setiap soal dalam satu batch memakai skenario dan topik yang BERBEDA. (7) Keempat opsi sama panjang dan sejenis. (8) Distraktor HARUS masuk akal di skenario yang sama dan memakai detail dari naskah (nama, tempat, waktu, angka, barang) yang dikaitkan dengan salah; DILARANG distraktor yang membahas hal tak berhubungan dengan skenario (mis. soal tentang buku panduan, distraktor tentang pekerjaan atau liburan). (9) Setiap fakta yang dipakai soal (peran pembicara, tempat, hubungan) HARUS disebut eksplisit di naskah; jangan bertanya tentang peran yang tidak pernah disebut. (10) Jawaban tidak boleh bisa ditebak dari akal sehat atau pola pilihan tanpa mendengar naskah; jawaban benar bukan satu-satunya opsi yang masuk akal secara umum. (11) Panjang opsi benar harus bervariasi: pada sekitar tiga dari empat soal opsi benar BUKAN yang terpanjang. (12) Semua kalimat soal dan opsi harus wajar dan jelas bagi penutur asli; jangan memakai rangkaian kata yang janggal hanya agar terlihat mirip.";
const QUALITY: Record<Kind, string> = {
  structure:
    "Kalimat natural berkosakata akademik; bagian kosong menuntut analisis struktur kalimat (klausa, paralelisme, inversi), bukan sekadar mencocokkan bentuk kata di sebelahnya. Keempat opsi sejenis dan sama panjang. DILARANG membuat soal reduced clause/participle yang pilihannya memuat dua participle (V-ing dan V3) yang dua-duanya bisa gramatikal; kalau menguji reduced clause, hanya SATU opsi berbentuk participle yang tepat dan pengecohnya jelas salah karena alasan tertentu (mis. subjek tidak cocok, bukan participle). Uji dulu setiap opsi dengan mengisinya ke kalimat sebelum menetapkan kunci.",
  written:
    "Kesalahan HANYA dari kategori yang tegas: bentuk/tense kata kerja, agreement yang tidak diperdebatkan, word form, artikel, preposisi, kata ganti relatif (whose/which), inversi, paralelisme, perbandingan, kata hubung. DILARANG: dangling/misplaced modifier, tanda baca, gaya/redundansi, aturan preskriptif yang diperdebatkan (split infinitive, that/which restriktif), agreement dengan \"a large share/number/majority/variety of + jamak\", kata benda kolektif, none/neither, dan perbedaan British vs American. Tiga bagian lain HARUS benar-benar benar secara gramatikal dan bagian yang salah tidak boleh bisa dibaca benar.",
  reading:
    "Gaya teks: artikel majalah sains populer (seperti National Geographic atau Scientific American), BUKAN laporan kaku. Kalimat bervariasi panjangnya, ada contoh konkret, angka atau nama tempat/tokoh, dan jangan mengulang pola \"Researchers found/Studies show\". Pertanyaan memakai rumusan baku TOEFL singkat (maks 20 kata): \"According to the passage…\", \"The author mentions X in order to…\", \"It can be inferred from paragraph 3 that…\", \"Which of the following is NOT…\". Hindari stem abstrak panjang dan hindari opsi yang semuanya berawalan \"It may…\". Sertakan minimal 2 soal inferensi dan 1 soal NOT/EXCEPT. Distraktor memakai kata dari teks tetapi salah makna; jawaban benar berupa parafrase, bukan salinan kalimat teks.",
  "listen-short":
    "Percakapan pendek 2 giliran antara dua orang di kampus (mahasiswa, dosen, staf, teman); pertanyaan tentang tujuan, topik, detail, maksud tersirat, atau tindakan berikutnya.",
  "listen-long":
    "Dialog kampus yang lebih panjang (sekitar 8-14 giliran) dengan satu masalah atau keputusan yang berkembang; soal mencakup ide utama, detail, dan inferensi.",
  "listen-lecture":
    "Monolog kuliah singkat (sekitar 150-220 kata) dengan struktur jelas (pengantar, contoh, kesimpulan) tentang satu topik akademik; soal mencakup ide utama, detail contoh, dan inferensi.",
};

const LEVEL_SCORE: Record<LevelBand, number> = { low: 400, mid: 500, high: 600 };

export type EprtContext = {
  config: AiConfig;
  extra: Record<string, unknown>;
  similar: Record<Kind, NearDupIndex>;
  seeds: { topics: string[]; scenes: string[] };
  /** Berapa soal terpilih yang opsi benarnya terpanjang; dipakai menahan bias panjang opsi selama satu proses. */
  lengthStats: Record<string, { n: number; longest: number }>;
  usage: TokenUsage;
};

const LENGTH_TRACKED: Kind[] = ["structure", "listen-short", "listen-long", "listen-lecture"];
const LENGTH_MAX_SHARE = 0.3;

function strictlyLongest(q: ToeflQuestion) {
  const lens = q.options.map((option) => option.length);
  return lens[q.answer] > Math.max(...lens.filter((_, i) => i !== q.answer));
}

/** Setelah cukup contoh, soal yang opsi benarnya terpanjang ditolak selama porsinya sudah di atas batas (dasar acak sekitar 22%). */
function lengthBalanced(ctx: EprtContext, kind: Kind, q: ToeflQuestion) {
  if (!LENGTH_TRACKED.includes(kind)) return true;
  const stats = ctx.lengthStats[kind];
  return !(stats && stats.n >= 20 && stats.longest / stats.n > LENGTH_MAX_SHARE && strictlyLongest(q));
}

/** Teks yang dibandingkan untuk deteksi duplikat: teks bacaan, naskah dialog/monolog, atau soal utuh. */
function signature(kind: Kind, item: { passage: string | null; questions: ToeflQuestion[] }) {
  if (kind === "reading") return item.passage ?? "";
  if (GROUPED.includes(kind)) return dialogueKey(item.questions[0]);
  return questionText(item.questions[0]);
}

const LOAD_PAGE = 2_000;

export type ContextOptions = {
  /** Hanya {n} item terbaru per jenis yang dimuat ke indeks (untuk permintaan web yang singkat). Kosong = seluruh bank. */
  recent?: number;
  /** Batasi jenis yang dimuat (bawaan semua). */
  kinds?: Kind[];
};

/**
 * Indeks teks nyaris kembar dari bank yang sudah ada, supaya hasil baru tidak menggandakan.
 * Dimuat per halaman (tidak pernah memegang seluruh isi bank di memori); duplikat persis juga
 * ditolak database lewat indeks unik (track, fingerprint), jadi jendela `recent` aman.
 */
export async function createEprtContext(
  config: AiConfig,
  extra: Record<string, unknown> = reasoningExtra(config),
  options: ContextOptions = {},
): Promise<EprtContext> {
  const similar = Object.fromEntries(
    KINDS.map((kind) => [
      kind,
      kind === "reading" || GROUPED.includes(kind) ? new NearDupIndex(PASSAGE_SIMILAR, { rows: 2 }) : new NearDupIndex(QUESTION_SIMILAR),
    ]),
  ) as Record<Kind, NearDupIndex>;
  const feed = (kind: Kind, raw: string) => {
    const item = JSON.parse(raw) as { passage: string | null; questions: ToeflQuestion[] };
    if (item.questions?.length) similar[kind].add(signature(kind, item));
  };
  for (const kind of options.kinds ?? KINDS) {
    const where = and(eq(questionBank.track, "eptr"), eq(questionBank.kind, kind));
    if (options.recent) {
      const rows = await db.select({ item: questionBank.item }).from(questionBank).where(where).orderBy(desc(questionBank.id)).limit(options.recent);
      for (const row of rows) feed(kind, row.item);
      continue;
    }
    for (let last = 0; ; ) {
      const rows = await db
        .select({ id: questionBank.id, item: questionBank.item })
        .from(questionBank)
        .where(and(where, gt(questionBank.id, last)))
        .orderBy(asc(questionBank.id))
        .limit(LOAD_PAGE);
      if (!rows.length) break;
      for (const row of rows) feed(kind, row.item);
      last = rows[rows.length - 1].id;
    }
  }
  return { config, extra, similar, seeds: { topics: [], scenes: [] }, lengthStats: Object.fromEntries(LENGTH_TRACKED.map((kind) => [kind, { n: 0, longest: 0 }])), usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
}

function tally(ctx: EprtContext, result: { usage: { promptTokens: number; completionTokens: number } }) {
  ctx.usage.promptTokens += result.usage.promptTokens;
  ctx.usage.completionTokens += result.usage.completionTokens;
}

/** Model menjawab soal tanpa kunci; hanya soal yang jawabannya sama dengan kunci yang lolos. Soal Listening disertai naskahnya. */
async function verify(ctx: EprtContext, kind: Kind, passage: string | null, questions: ToeflQuestion[]) {
  let lastScript = "";
  const body = questions
    .map((q, i) => {
      // Naskah dicetak sekali per dialog/monolog; soal berikutnya yang memakai naskah sama tidak mengulanginya.
      const script = isListening(kind) ? dialogueKey(q) : "";
      const header = script && script !== lastScript ? `[Naskah]\n${script}\n\n` : "";
      if (script) lastScript = script;
      return `${header}${i + 1}. ${q.q}\n${q.options.map((option, j) => `${"ABCD"[j]}. ${option}`).join("\n")}`;
    })
    .join("\n\n");
  const task =
    kind === "written"
      ? "Tiap soal berupa satu kalimat dengan empat bagian bergaris bawah (A-D). Pilih bagian yang SALAH tata bahasanya."
      : isListening(kind)
        ? "Tiap soal didahului naskah percakapan/monolog; soal tanpa naskah baru memakai naskah terakhir di atasnya. Jawab HANYA berdasarkan naskah."
        : "Pilih satu jawaban paling benar untuk tiap soal.";
  const messages: ProviderMessage[] = [
    {
      role: "system",
      content: `Kamu penjawab soal bahasa Inggris gaya TOEFL ITP. ${task} Nilai SETIAP opsi satu per satu dengan mengisinya ke kalimat. Balas HANYA JSON {"answers":["A","C",...],"acceptable":[["A"],["C","D"],...],"natural":[true,false,...]} urut sesuai nomor: "answers" = satu huruf pilihan terbaik per soal; "acceptable" = untuk tiap soal SEMUA huruf opsi yang bisa dibenarkan menurut bahasa Inggris formal baku (untuk Written: semua bagian yang bisa dianggap salah; untuk Listening: semua opsi yang didukung naskah); "natural" = true bila kalimat soal (atau naskah) beserta opsi KUNCI yang benar terdengar wajar dan jelas bagi penutur asli, false bila kalimat/naskah atau opsi benarnya janggal, kaku, atau berarti ganda (pengecoh memang boleh salah; jangan menilainya).`,
    },
    { role: "user", content: `${passage ? `Teks:\n${passage}\n\n` : ""}${body}` },
  ];
  // Model pemeriksa terpisah (kalau diatur) menangkap kesalahan yang konsisten pada model pembuat.
  const checker = ctx.config.verifyModel ? { ...ctx.config, model: ctx.config.verifyModel } : ctx.config;
  const result = await chatJsonRaw(checker, messages, undefined, ctx.extra);
  tally(ctx, result);
  const parsed = parseAiJson(result.content) as { answers?: unknown; acceptable?: unknown; natural?: unknown };
  if (process.env.EPRT_DEBUG) console.error(`[verify ${kind}] kunci=${questions.map((q) => "ABCD"[q.answer]).join("")} balasan=${result.content.slice(0, 600)}`);
  const answers = parsed.answers;
  if (!Array.isArray(answers) || answers.length !== questions.length) return [];
  // Lolos hanya kalau jawaban pemeriksa sama dengan kunci DAN kuncinya satu-satunya opsi yang bisa dibenarkan.
  // Kalau pemeriksa tidak mengisi "acceptable" dengan benar, cek ini dilewati (jangan membuang semuanya).
  const acceptable = Array.isArray(parsed.acceptable) && parsed.acceptable.length === questions.length ? parsed.acceptable : null;
  const onlyKey = (i: number, letter: string) => {
    const set = acceptable?.[i];
    return !Array.isArray(set) || (set.length === 1 && String(set[0]).trim().toUpperCase().startsWith(letter));
  };
  // Soal yang dinilai janggal/kaku/berarti ganda oleh pemeriksa dibuang; kalau daftar tidak valid, cek ini dilewati.
  const natural = Array.isArray(parsed.natural) && parsed.natural.length === questions.length ? parsed.natural : null;
  return questions.filter(
    (q, i) => String(answers[i]).trim().toUpperCase().startsWith("ABCD"[q.answer]) && onlyKey(i, "ABCD"[q.answer]) && natural?.[i] !== false,
  );
}

/** Soal Listening yang bisa dijawab benar DAN dengan yakin tanpa naskah (hanya dari soal dan pilihan) dibuang: pengecohnya terlalu mudah. */
async function dropGuessable(ctx: EprtContext, questions: ToeflQuestion[]) {
  const body = questions
    .map((q, i) => `${i + 1}. ${q.q}\n${q.options.map((option, j) => `${"ABCD"[j]}. ${option}`).join("\n")}`)
    .join("\n\n");
  const messages: ProviderMessage[] = [
    {
      role: "system",
      content:
        'Kamu penjawab soal listening TOEFL ITP, tetapi naskahnya TIDAK diberikan. Jawab dengan tebakan terbaik dari soal dan pilihannya saja. Balas HANYA JSON {"answers":["A","C",...],"sure":[true,false,...]} urut sesuai nomor; "sure" true hanya kalau kamu benar-benar yakin tanpa naskah (jawabannya jelas dari akal sehat atau pola pilihan), false kalau hanya menebak.',
    },
    { role: "user", content: body },
  ];
  const result = await chatJsonRaw(ctx.config, messages, undefined, ctx.extra);
  tally(ctx, result);
  const parsed = parseAiJson(result.content) as { answers?: unknown; sure?: unknown };
  if (!Array.isArray(parsed.answers) || !Array.isArray(parsed.sure) || parsed.answers.length !== questions.length) return questions;
  const sure = parsed.sure;
  const answers = parsed.answers;
  return questions.filter(
    (q, i) => !(String(answers[i]).trim().toUpperCase().startsWith("ABCD"[q.answer]) && sure[i] === true),
  );
}

/**
 * Penjelasan jawaban (Bahasa Indonesia) tidak pernah diperiksa oleh langkah lain: kunci bisa benar sementara penjelasannya salah
 * atau menyesatkan. Pemeriksa kedua membaca soal + kunci + penjelasan dan membuang yang tidak akurat. Matikan dengan EPRT_CHECK_EXPLAIN=0.
 */
async function dropBadExplanations(ctx: EprtContext, kind: Kind, passage: string | null, questions: ToeflQuestion[]) {
  if (process.env.EPRT_CHECK_EXPLAIN === "0" || !questions.length) return questions;
  let lastScript = "";
  const body = questions
    .map((q, i) => {
      const script = isListening(kind) ? dialogueKey(q) : "";
      const header = script && script !== lastScript ? `[Naskah]\n${script}\n\n` : "";
      if (script) lastScript = script;
      const key = q.options[q.answer];
      const target = kind === "written" ? `Bagian yang salah (kunci): ${key}` : `Jawaban benar (kunci): ${key}`;
      return `${header}${i + 1}. ${q.q}\n${target}\nPenjelasan: ${q.explain_id}`;
    })
    .join("\n\n");
  const messages: ProviderMessage[] = [
    {
      role: "system",
      content:
        'Kamu pemeriksa penjelasan jawaban soal bahasa Inggris gaya TOEFL ITP. Tiap soal diberi kalimat/pertanyaan, kunci, dan penjelasan berbahasa Indonesia. "ok" = true bila penjelasan akurat, sesuai dengan kunci, tidak memuat klaim tata bahasa atau isi yang salah, dan tidak menyebut huruf opsi; false bila salah, menyesatkan, bertentangan dengan kunci, atau tidak menjelaskan alasan yang benar. Balas HANYA JSON {"ok":[true,false,...]} urut sesuai nomor.',
    },
    { role: "user", content: `${passage ? `Teks:\n${passage}\n\n` : ""}${body}` },
  ];
  const checker = ctx.config.verifyModel ? { ...ctx.config, model: ctx.config.verifyModel } : ctx.config;
  const result = await chatJsonRaw(checker, messages, undefined, ctx.extra);
  tally(ctx, result);
  const ok = (parseAiJson(result.content) as { ok?: unknown }).ok;
  if (process.env.EPRT_DEBUG) console.error(`[explain ${kind}] ok=${JSON.stringify(ok)}`);
  if (!Array.isArray(ok) || ok.length !== questions.length) return questions;
  return questions.filter((_, i) => ok[i] !== false);
}

function prompt(ctx: EprtContext, kind: Kind, band: LevelBand, topic?: string) {
  const level = LEVEL_SCORE[band];
  const test = `TOEFL ITP (skala mirip TOEFL ITP) ${level}`;
  const rubric = levelRubric(level);
  const list = (items: string[]) => items.map((t, i) => `${i + 1}. ${t}`).join("; ");

  if (kind === "reading") {
    const [picked] = topic ? [topic] : pickFresh(SUBTOPICS, ctx.seeds.topics, 1);
    ctx.seeds.topics = rememberSeeds(ctx.seeds.topics, [picked], 5_000);
    const subject = topic ? picked : `${picked} ${pickModifier()}`;
    return `Buat ${READING_QUESTIONS} soal, tingkat setara ${test}.\n${rubric}\nTopik teks: "${subject}". Bentuk teks: ${pickRegister()}. Sudut pembahasan: ${readingAngle()}.`;
  }
  if (kind === "listen-short" || kind === "listen-long") {
    const n = kind === "listen-short" ? PER_CALL[kind] : TALKS;
    const scenes = topic ? Array.from({ length: n }, () => topic) : pickScenes(ctx.seeds.scenes, n);
    ctx.seeds.scenes = rememberSeeds(ctx.seeds.scenes, scenes, 5_000);
    const hooks = pickHooks(n);
    const plans = scenes.map((scene, i) => (topic ? scene : `${scene} (dinamika: ${hooks[i]})`));
    return kind === "listen-short"
      ? `Buat ${n} soal, tingkat setara ${test}.\n${rubric}\nSkenario tiap soal (urut, satu skenario per soal): ${list(plans)}.`
      : `Buat ${n} dialog panjang berbeda, masing-masing dengan ${PER_TALK} soal (total ${n * PER_TALK} soal), tingkat setara ${test}.\n${rubric}\nSkenario tiap dialog (urut): ${list(plans)}.`;
  }
  if (kind === "listen-lecture") {
    const topics = topic ? Array.from({ length: TALKS }, () => topic) : pickFresh(SUBTOPICS, ctx.seeds.topics, TALKS);
    ctx.seeds.topics = rememberSeeds(ctx.seeds.topics, topics, 5_000);
    return `Buat ${TALKS} monolog berbeda, masing-masing dengan ${PER_TALK} soal (total ${TALKS * PER_TALK} soal), tingkat setara ${test}.\n${rubric}\nTopik tiap monolog (urut): ${list(topics.map((t) => `${talkStyle()} about ${topic ? t : `${t} ${pickModifier()}`}`))}.`;
  }
  const count = PER_CALL[kind];
  const topics = topic ? Array.from({ length: count }, () => topic) : pickFresh(SUBTOPICS, ctx.seeds.topics, count);
  ctx.seeds.topics = rememberSeeds(ctx.seeds.topics, topics, 5_000);
  const points = pickPoints(kind as "structure" | "written", band, count);
  const label = kind === "structure" ? "titik yang diuji" : "jenis kesalahan yang disisipkan";
  const plan = topics.map((t, i) => `${i + 1}. konteks: ${topic ? t : `${t} ${pickModifier()}`}; ${label}: ${points[i]}`);
  return `Buat ${count} soal, tingkat setara ${test}.\n${rubric}\nRencana tiap soal (urut, satu baris per soal; ikuti persis, jangan menyalin teks rencana ke dalam soal):\n${plan.join("\n")}`;
}

/** Satu panggilan AI + verifikasi + simpan ke bank. Melempar Error kalau tidak ada yang layak. */
export async function generateEprtBatch(ctx: EprtContext, kind: Kind, band: LevelBand, topic?: string) {
  const grouped = GROUPED.includes(kind);
  const messages: ProviderMessage[] = [
    { role: "system", content: BUILD_SYSTEM.eptr[kind] },
    {
      role: "user",
      content: `${prompt(ctx, kind, band, topic)}\n${isListening(kind) ? QUALITY_LISTENING : QUALITY_COMMON}\n${QUALITY[kind]}\nPENTING: field "answer" adalah indeks berbasis 0 (0=A, 1=B, 2=C, 3=D), bukan mulai dari 1.`,
    },
  ];
  const result = await chatJsonRaw(ctx.config, messages, undefined, ctx.extra);
  tally(ctx, result);
  const parsed = parseAiJson(result.content);
  const passage = kind === "reading" && typeof parsed.passage === "string" ? parsed.passage.trim() : null;
  if (kind === "reading" && (!passage || copiesExample(passage) || ctx.similar.reading.has(passage))) {
    throw new Error("teks tidak valid atau mirip yang sudah ada");
  }
  const candidates = sanitizeQuestions(parsed.questions, questionType(kind), grouped).filter(
    (q) =>
      !copiesExample(questionText(q)) &&
      q.explain_id &&
      (kind === "reading" || !ctx.similar[kind].has(grouped ? dialogueKey(q) : questionText(q))) &&
      lengthBalanced(ctx, kind, q),
  );
  if (!candidates.length) throw new Error("tidak ada soal valid");

  const verified = await verify(ctx, kind, passage, candidates);
  const unguessable = isListening(kind) && verified.length ? await dropGuessable(ctx, verified) : verified;
  const kept = await dropBadExplanations(ctx, kind, passage, unguessable);
  let items: { passage: string | null; questions: ToeflQuestion[] }[];
  if (kind === "reading") {
    items = kept.length >= READING_MIN && passage ? [{ passage, questions: kept }] : [];
  } else if (grouped) {
    // Satu item = satu naskah dengan soal-soalnya; naskah yang kehilangan terlalu banyak soal dibuang utuh.
    const talks = new Map<string, ToeflQuestion[]>();
    for (const question of kept) talks.set(dialogueKey(question), [...(talks.get(dialogueKey(question)) ?? []), question]);
    items = [...talks.values()].filter((questions) => questions.length >= TALK_MIN_QUESTIONS).map((questions) => ({ passage: null, questions }));
  } else {
    items = kept.map((question) => ({ passage: null, questions: [question] }));
  }
  for (const item of items) ctx.similar[kind].add(signature(kind, item));
  const tracked = ctx.lengthStats[kind];
  if (tracked) {
    for (const item of items) {
      for (const question of item.questions) {
        tracked.n += 1;
        if (strictlyLongest(question)) tracked.longest += 1;
      }
    }
  }
  await saveBankItems(
    items.map((item) => ({
      track: "eptr" as const,
      kind,
      levelBand: band,
      fingerprint: fingerprint(grouped ? dialogueKey(item.questions[0]) : (item.passage ?? questionText(item.questions[0]))),
      skill: item.questions[0]?.skill ?? null,
      questionCount: item.questions.length,
      item: JSON.stringify(item),
    })),
  );
  return { n: items.length, dropped: candidates.length - items.reduce((sum, item) => sum + item.questions.length, 0) };
}
