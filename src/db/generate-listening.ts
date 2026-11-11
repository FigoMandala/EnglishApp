import { createHash } from "node:crypto";

import { count, eq } from "drizzle-orm";

import "./load-env";

import { contentDb } from "./content";
import { listeningQuestions, listeningTalks, type ContentLanguage } from "./content-schema";
import { levelBand } from "./queries/question-bank";
import { chatJsonRaw, type ProviderMessage } from "@/lib/ai-client";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { estimateCostUsd, type TokenUsage } from "@/lib/ai-pricing";
import { BUILD_SYSTEM, levelRubric, parseAiJson, sanitizeQuestions } from "@/lib/api/toefl-turn";
import {
  copiesExample,
  normalize,
  pickFresh,
  pickScenes,
  questionText,
  rememberSeeds,
  SimilarityIndex,
  SUBTOPICS,
  talkStyle,
} from "@/lib/question-variety";
import { dialogueKey, type AudioLine, type SkillKey, type ToeflQuestion } from "@/lib/toefl";

/**
 * Bank soal Listening ke DB konten (pakai AI_API_KEY seperti pembuat soal di aplikasi).
 * Bisa dilanjutkan: soal ganda dibuang lewat hash, jadi menjalankan ulang aman.
 *
 *   LISTENING_TARGET=10000      jumlah SOAL (bukan percakapan) di bank setelah selesai
 *   LISTENING_LANGUAGE=en       bahasa isi soal (en | ja); bank tiap bahasa dihitung terpisah
 *   LISTENING_MAX_CALLS=5       batasi panggilan AI (uji coba kecil dulu)
 *   LISTENING_CONCURRENCY=4     panggilan AI paralel
 */
const TARGET = Number(process.env.LISTENING_TARGET ?? 10_000);
const LANGUAGE = (process.env.LISTENING_LANGUAGE ?? "en") as ContentLanguage;
const MAX_CALLS = process.env.LISTENING_MAX_CALLS ? Number(process.env.LISTENING_MAX_CALLS) : Infinity;
const CONCURRENCY = Number(process.env.LISTENING_CONCURRENCY ?? 4);
const MAX_FAILURES_IN_ROW = 8;

type Kind = "listen-short" | "listen-long" | "listen-lecture";

/** Porsi soal per jenis, dan isi satu panggilan AI. */
const PLAN: Record<Kind, { share: number; talks: number; perTalk: number; label: string }> = {
  "listen-short": { share: 0.5, talks: 10, perTalk: 1, label: "percakapan pendek" },
  "listen-long": { share: 0.3, talks: 3, perTalk: 3, label: "dialog panjang" },
  "listen-lecture": { share: 0.2, talks: 3, perTalk: 4, label: "monolog" },
};
const KINDS = Object.keys(PLAN) as Kind[];
const LEVELS = [400, 500, 600];

const sha = (text: string) => createHash("sha256").update(normalize(text)).digest("hex");
const scriptOf = (question: ToeflQuestion): AudioLine[] =>
  (question.audio ?? []).filter((line) => line.speaker !== "narrator");

async function main() {
  const config = await getAiConfig();
  if (!aiConfigured(config)) {
    console.error("AI_API_KEY belum diisi (.env.local atau Pengaturan aplikasi).");
    process.exit(1);
  }

  // Keadaan awal dari DB, supaya bisa dilanjutkan dan tidak menggandakan. Hitung hanya bahasa yang sedang dibuat.
  const have: Record<Kind, number> = { "listen-short": 0, "listen-long": 0, "listen-lecture": 0 };
  for (const row of await contentDb
    .select({ kind: listeningTalks.kind, n: count() })
    .from(listeningQuestions)
    .innerJoin(listeningTalks, eq(listeningQuestions.talkId, listeningTalks.id))
    .where(eq(listeningTalks.language, LANGUAGE))
    .groupBy(listeningTalks.kind)) {
    have[row.kind] = row.n;
  }
  const existing = await contentDb
    .select({ script: listeningTalks.script })
    .from(listeningTalks)
    .where(eq(listeningTalks.language, LANGUAGE));
  const similar = new SimilarityIndex(existing.map((row) => row.script.map((line) => line.text).join(" ")));
  const existingQuestions = new Set(
    (await contentDb.select({ hash: listeningQuestions.hash }).from(listeningQuestions)).map((row) => row.hash),
  );
  console.log(`Bahasa: ${LANGUAGE}. Bank sekarang: ${KINDS.map((k) => `${k}=${have[k]}`).join(", ")}; target total ${TARGET}.`);

  const seeds = { topics: [] as string[], scenes: [] as string[] };
  const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const inFlight: Record<Kind, number> = { "listen-short": 0, "listen-long": 0, "listen-lecture": 0 };
  let calls = 0;
  let failuresInRow = 0;
  let addedQuestions = 0;

  const need = (kind: Kind) =>
    Math.ceil(TARGET * PLAN[kind].share) - have[kind] - inFlight[kind] * PLAN[kind].talks * PLAN[kind].perTalk;
  const nextKind = () => KINDS.filter((kind) => need(kind) > 0).sort((a, b) => need(b) / PLAN[b].share - need(a) / PLAN[a].share)[0];

  function prompt(kind: Kind, level: number) {
    const { talks, perTalk } = PLAN[kind];
    const test = `EPrT (skala mirip TOEFL ITP) ${level}`;
    if (kind === "listen-short") {
      const scenes = pickScenes(seeds.scenes, talks);
      seeds.scenes = rememberSeeds(seeds.scenes, scenes, 20_000);
      return `Buat ${talks} soal, tingkat setara ${test}.\nSkenario tiap soal (urut, satu skenario per soal): ${scenes.map((s, i) => `${i + 1}. ${s}`).join("; ")}.`;
    }
    if (kind === "listen-long") {
      const scenes = pickScenes(seeds.scenes, talks);
      seeds.scenes = rememberSeeds(seeds.scenes, scenes, 20_000);
      return `Buat ${talks} dialog panjang berbeda, masing-masing dengan ${perTalk} soal (total minimal ${talks * perTalk} soal), tingkat setara ${test}.\nBuat tepat ${talks} dialog, masing-masing dengan ${perTalk} soal. Skenario tiap dialog (urut): ${scenes.map((s, i) => `${i + 1}. ${s}`).join("; ")}.`;
    }
    const topics = pickFresh(SUBTOPICS, seeds.topics, talks);
    seeds.topics = rememberSeeds(seeds.topics, topics, 5_000);
    return `Buat ${talks} monolog berbeda, masing-masing dengan ${perTalk} soal (total minimal ${talks * perTalk} soal), tingkat setara ${test}.\nBuat tepat ${talks} monolog, masing-masing dengan ${perTalk} soal. Topik tiap monolog (urut): ${topics.map((t, i) => `${i + 1}. ${talkStyle()} about ${t}`).join("; ")}.`;
  }

  async function runOne(kind: Kind) {
    const level = LEVELS[Math.floor(Math.random() * LEVELS.length)];
    const messages: ProviderMessage[] = [
      { role: "system", content: BUILD_SYSTEM.eptr[kind] },
      { role: "user", content: `${prompt(kind, level)}\n${levelRubric(level)}` },
    ];
    const result = await chatJsonRaw(config, messages);
    usage.promptTokens += result.usage.promptTokens;
    usage.completionTokens += result.usage.completionTokens;
    const grouped = kind !== "listen-short";
    const questions = sanitizeQuestions(parseAiJson(result.content).questions, "listening", grouped);
    if (!questions.length) throw new Error("tidak ada soal valid");

    // Satu percakapan = satu kunci skrip (tanpa baris narator).
    const talks = new Map<string, ToeflQuestion[]>();
    for (const question of questions) {
      if (copiesExample(questionText(question)) || !question.explain_id) continue;
      const key = dialogueKey(question);
      talks.set(key, [...(talks.get(key) ?? []), question]);
    }

    let added = 0;
    for (const group of talks.values()) {
      const script = scriptOf(group[0]);
      const scriptText = script.map((line) => line.text).join(" ");
      if (script.length < 2 && kind !== "listen-lecture") continue;
      if (similar.has(scriptText)) continue;
      similar.add(scriptText);

      const [talk] = await contentDb
        .insert(listeningTalks)
        .values({ kind, level: levelBand(level), language: LANGUAGE, script, hash: sha(scriptText) })
        .onConflictDoNothing()
        .returning({ id: listeningTalks.id });
      if (!talk) continue;

      const rows = group
        .map((question) => ({
          talkId: talk.id,
          skill: (question.skill ?? kind) as SkillKey,
          question: question.q,
          options: question.options,
          answer: question.answer,
          explainId: question.explain_id,
          hash: sha(`${scriptText} ${question.q} ${[...question.options].sort().join(" ")}`),
        }))
        .filter((row) => !existingQuestions.has(row.hash));
      if (!rows.length) continue;
      for (const row of rows) existingQuestions.add(row.hash);
      await contentDb.insert(listeningQuestions).values(rows).onConflictDoNothing();
      added += rows.length;
    }
    have[kind] += added;
    addedQuestions += added;
    return added;
  }

  async function worker() {
    while (calls < MAX_CALLS && failuresInRow < MAX_FAILURES_IN_ROW) {
      const kind = nextKind();
      if (!kind) return;
      calls += 1;
      inFlight[kind] += 1;
      try {
        const added = await runOne(kind);
        failuresInRow = 0;
        const total = KINDS.reduce((sum, k) => sum + have[k], 0);
        console.log(`+ ${PLAN[kind].label}: ${added} soal (total ${total}/${TARGET})`);
      } catch (error) {
        failuresInRow += 1;
        console.error(`! ${PLAN[kind].label}:`, error instanceof Error ? error.message : error);
      } finally {
        inFlight[kind] -= 1;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const total = KINDS.reduce((sum, k) => sum + have[k], 0);
  console.log(`\nSelesai. Ditambah ${addedQuestions} soal dalam ${calls} panggilan. Total bank: ${total} (${KINDS.map((k) => `${k}=${have[k]}`).join(", ")}).`);
  console.log(`Token: ${usage.promptTokens} masuk, ${usage.completionTokens} keluar. Perkiraan biaya: $${estimateCostUsd(config.model, usage).toFixed(4)} (model ${config.model}).`);
  if (failuresInRow >= MAX_FAILURES_IN_ROW) console.error("Berhenti: terlalu banyak kegagalan berturut-turut. Cek key/saldo/model.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
