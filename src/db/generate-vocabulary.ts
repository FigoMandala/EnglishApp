import { count } from "drizzle-orm";

import "./load-env";

import { db } from "./index";
import { vocabulary, type NewVocabulary } from "./schema";
import { chatCompletionDetailed } from "@/lib/ai-client";
import { getAiConfig } from "@/lib/ai-config";
import { estimateCostUsd } from "@/lib/ai-pricing";
import {
  LEVEL_LABEL,
  normalizeWord,
  parseGeneratedWords,
  toVocabRow,
  type VocabLevel,
} from "@/lib/vocabulary-generator";

/** Tema & tingkat kesulitan yang akan dibuat. Ubah sesuai kebutuhan. */
const TOPICS: { topic: string; levels: VocabLevel[] }[] = [
  { topic: "Keluarga & orang", levels: ["basic", "intermediate"] },
  { topic: "Makanan & minuman", levels: ["basic", "intermediate"] },
  { topic: "Angka, waktu & tanggal", levels: ["basic", "intermediate"] },
  { topic: "Warna & bentuk", levels: ["basic"] },
  { topic: "Rumah & perabot", levels: ["basic", "intermediate"] },
  { topic: "Hewan & alam", levels: ["basic", "intermediate"] },
  { topic: "Tubuh & kesehatan", levels: ["basic", "intermediate"] },
  { topic: "Pakaian & belanja", levels: ["basic", "intermediate"] },
  { topic: "Perjalanan & arah", levels: ["basic", "intermediate"] },
  { topic: "Sekolah & belajar", levels: ["basic", "intermediate", "advanced"] },
  { topic: "Pekerjaan & kantor", levels: ["intermediate", "advanced"] },
  { topic: "Perasaan & kepribadian", levels: ["basic", "intermediate"] },
  { topic: "Olahraga & hobi", levels: ["basic", "intermediate"] },
  { topic: "Cuaca & musim", levels: ["basic", "intermediate"] },
  { topic: "Teknologi sehari-hari", levels: ["intermediate", "advanced"] },
  { topic: "Kata kerja umum", levels: ["basic", "intermediate"] },
  { topic: "Kata sifat umum", levels: ["basic", "intermediate"] },
  { topic: "Kata keterangan umum", levels: ["intermediate", "advanced"] },
  { topic: "Akademik", levels: ["intermediate", "advanced"] },
  { topic: "Bisnis", levels: ["intermediate", "advanced"] },
];

const WORDS_PER_BATCH = Number(process.env.VOCAB_BATCH_SIZE ?? 20);
const CONCURRENCY = Number(process.env.VOCAB_CONCURRENCY ?? 3);
const MAX_BATCHES = process.env.VOCAB_MAX_BATCHES ? Number(process.env.VOCAB_MAX_BATCHES) : Infinity;

const SYSTEM = [
  "Kamu penyusun kosakata Bahasa Inggris untuk pembelajar Indonesia.",
  "Buat kata-kata yang sering dipakai dan sesuai tingkat kesulitan yang diminta.",
  "Untuk level basic: kata sehari-hari yang paling umum.",
  "Untuk level intermediate: kata yang cukup sering muncul di bacaan.",
  "Untuk level advanced: kata akademik atau formal, tapi tetap masuk akal dipakai.",
  "Terjemahan (meaning) singkat dalam Bahasa Indonesia, tanpa tanda kurung penjelasan panjang.",
  "Phonetic memakai IPA dengan garis miring, contoh: /əˈbʌn.dənt/.",
  "Jangan mengulang kata yang sudah ada di daftar terlarang.",
  "Jangan pakai karakter em dash.",
  "Balas HANYA dengan array JSON valid tanpa pagar kode dan tanpa teks lain.",
].join(" ");

function buildPrompt(topic: string, level: VocabLevel, avoid: string[], amount: number) {
  const avoidLine = avoid.length ? `Jangan pakai kata ini: ${avoid.slice(0, 120).join(", ")}.` : "";
  return [
    `Tema: ${topic}.`,
    `Level: ${level} (${LEVEL_LABEL[level]}).`,
    `Jumlah: ${amount} kata.`,
    avoidLine,
    "",
    "Format tiap item:",
    '{"word":"...","meaning":"arti singkat","phonetic":"/.../","partOfSpeech":"noun|verb|adjective|adverb|preposition","exampleEn":"contoh kalimat bahasa inggris","exampleId":"terjemahan contoh","level":"' +
      level +
      '","topic":"' +
      topic +
      '"}',
  ]
    .filter(Boolean)
    .join("\n");
}

async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const config = await getAiConfig();
  if (!config.apiKey) {
    console.error("AI_API_KEY belum diisi. Isi di .env.local atau lewat halaman Pengaturan.");
    process.exit(1);
  }

  const existingRows = await db.select({ wordLower: vocabulary.wordLower }).from(vocabulary);
  const existing = new Set(existingRows.map((row) => row.wordLower));
  console.log(`Kata yang sudah ada: ${existing.size}`);

  const jobs: { topic: string; level: VocabLevel }[] = [];
  for (const entry of TOPICS) {
    if (jobs.length >= MAX_BATCHES) break;
    for (const level of entry.levels) {
      if (jobs.length >= MAX_BATCHES) break;
      jobs.push({ topic: entry.topic, level });
    }
  }
  console.log(`Batch yang akan dibuat: ${jobs.length} (${WORDS_PER_BATCH} kata per batch)`);

  let added = 0;
  let cost = 0;

  const tasks = jobs.map((job) => async () => {
    try {
      const avoid = [...existing].slice(-150);
      const result = await chatCompletionDetailed(config, [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(job.topic, job.level, avoid, WORDS_PER_BATCH) },
      ]);
      cost += estimateCostUsd(config.model, result.usage);

      const words = parseGeneratedWords(result.content, job, existing);
      if (words.length === 0) {
        console.warn(`- ${job.topic} / ${job.level}: tidak ada kata baru.`);
        return;
      }

      for (const item of words) existing.add(normalizeWord(item.word));
      await db.insert(vocabulary).values(words.map(toVocabRow) as NewVocabulary[]);
      added += words.length;
      console.log(`+ ${job.topic} / ${job.level}: ${words.length} kata`);
    } catch (error) {
      console.error(`! ${job.topic} / ${job.level}:`, error instanceof Error ? error.message : error);
    }
  });

  await pool(tasks, CONCURRENCY);

  const [total] = await db.select({ n: count() }).from(vocabulary);
  console.log(`\nSelesai. Ditambahkan ${added} kata. Total di database: ${total?.n ?? 0}.`);
  console.log(`Perkiraan biaya AI: $${cost.toFixed(4)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });