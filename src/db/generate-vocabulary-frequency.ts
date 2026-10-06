import { count } from "drizzle-orm";

import "./load-env";

import { db } from "./index";
import { vocabulary, type NewVocabulary } from "./schema";
import { chatCompletionDetailed } from "@/lib/ai-client";
import { getAiConfig } from "@/lib/ai-config";
import { estimateCostUsd } from "@/lib/ai-pricing";
import {
  loadFrequencyList,
  type FrequencyEntry,
} from "@/lib/vocabulary-frequency";
import { normalizeWord, parseGeneratedWords, toVocabRow } from "@/lib/vocabulary-generator";

const TARGET = Number(process.env.VOCAB_TARGET ?? 2000);
const BATCH = Number(process.env.VOCAB_BATCH ?? 25);
const CONCURRENCY = Number(process.env.VOCAB_CONCURRENCY ?? 4);

const SYSTEM = [
  "Kamu penyusun kamus Bahasa Inggris untuk pembelajar Indonesia.",
  "Untuk setiap kata yang diberikan, isi arti singkat, fonetik IPA, jenis kata, dan contoh kalimat.",
  "Terjemahan (meaning) singkat dan langsung dalam Bahasa Indonesia.",
  "Jangan mengubah bentuk kata yang diberikan; kata wajib sama persis.",
  "Bila suatu kata bersifat teknis atau jarang, tetap beri arti yang paling umum dipakai.",
  "Jangan pakai karakter em dash.",
  "Balas HANYA dengan array JSON valid tanpa pagar kode dan tanpa teks lain.",
].join(" ");

function buildPrompt(entries: FrequencyEntry[]) {
  return [
    "Buat entri untuk kata-kata berikut. Jaga urutannya.",
    entries.map((entry) => entry.word).join(", "),
    "",
    "Format tiap item:",
    '{"word":"kata asli","meaning":"arti singkat","phonetic":"/.../","partOfSpeech":"noun|verb|adjective|adverb|preposition|pronoun|conjunction|determiner","exampleEn":"contoh kalimat","exampleId":"terjemahan contoh"}',
  ].join("\n");
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
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
    console.error("AI_API_KEY belum diisi.");
    process.exit(1);
  }

  const existingRows = await db.select({ wordLower: vocabulary.wordLower }).from(vocabulary);
  const existing = new Set(existingRows.map((row) => row.wordLower));
  console.log(`Kata yang sudah ada: ${existing.size}`);

  const list = loadFrequencyList(TARGET);
  const candidates = list.filter((entry) => !existing.has(entry.word));
  console.log(`Target: ${TARGET} kata. Perlu dibuat: ${candidates.length}.`);

  const batches = chunk(candidates, BATCH);
  console.log(`Batch: ${batches.length} (${BATCH} kata per batch)`);

  let added = 0;
  let cost = 0;

  const tasks = batches.map((entries) => async () => {
    const rankOf = new Map(entries.map((entry) => [normalizeWord(entry.word), entry.rank]));
    try {
      const result = await chatCompletionDetailed(config, [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(entries) },
      ]);
      cost += estimateCostUsd(config.model, result.usage);

      const parsed = parseGeneratedWords(result.content, { level: "intermediate", topic: "Frekuensi tinggi" }, new Set());
      const wanted = new Set(entries.map((entry) => normalizeWord(entry.word)));
      const kept = parsed.filter((item) => wanted.has(normalizeWord(item.word)));
      if (kept.length === 0) {
        console.warn(`- batch ${entries[0]?.word}..${entries[entries.length - 1]?.word}: kosong.`);
        return;
      }

      const rows = kept.map((item) => ({
        ...toVocabRow(item),
        frequencyRank: rankOf.get(normalizeWord(item.word)) ?? null,
      })) as NewVocabulary[];
      await db.insert(vocabulary).values(rows);
      added += rows.length;
      console.log(`+ ${entries[0]?.word}..${entries[entries.length - 1]?.word}: ${rows.length} kata`);
    } catch (error) {
      console.error(`! batch ${entries[0]?.word}:`, error instanceof Error ? error.message : error);
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