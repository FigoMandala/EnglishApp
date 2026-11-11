import { count, eq } from "drizzle-orm";

import "./load-env";

import { db } from "@/db";
import { questionBank } from "@/db/schema";
import type { LevelBand } from "./queries/question-bank";
import { setAiConcurrency } from "@/lib/ai-client";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { estimateCostUsd } from "@/lib/ai-pricing";
import { BANDS as ALL_BANDS, createEprtContext, generateEprtBatch, KINDS, PER_CALL, type Kind } from "@/lib/eprt-generate";

/**
 * Bank soal EPrT (Structure, Written, Reading) ke question_bank, tiga level.
 * Bisa dilanjutkan: soal ganda dibuang lewat fingerprint, jadi menjalankan ulang aman.
 * Tiap soal dijawab ulang oleh model tanpa kunci; yang jawabannya beda dibuang.
 *
 *   BANK_SCALE=1.2        pengali target (1.0 = persis 100 simulasi per level)
 *   BANK_LEVELS=low,mid   batasi level (bawaan semuanya)
 *   MAX_CALLS=9           batasi panggilan AI (uji coba kecil dulu)
 *   BANK_KINDS=structure,written   batasi jenis (bawaan semuanya, termasuk Listening)
 *   CONCURRENCY=6         batch paralel; juga batas panggilan AI serentak (provider menolak di atas ~15)
 *   MAX_COST_USD=50       berhenti kalau perkiraan biaya melewati ini
 *   AI_PRICES='{"model":{"input":1,"output":4}}'   harga per juta token (model baru tidak ada di tabel bawaan)
 *   AI_MODEL=...          timpa model (bawaan: yang tersimpan di Pengaturan)
 */
const SCALE = Number(process.env.BANK_SCALE ?? 1.2);
const MAX_CALLS = process.env.MAX_CALLS ? Number(process.env.MAX_CALLS) : Infinity;
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);
const MAX_COST_USD = process.env.MAX_COST_USD ? Number(process.env.MAX_COST_USD) : Infinity;
const MAX_FAILURES_IN_ROW = Number(process.env.MAX_FAILURES_IN_ROW ?? 8);
/** Model penalar (mis. deepseek) menghabiskan ~70% token untuk berpikir; "low" memangkas waktu dan biaya. */
const EXTRA = process.env.AI_REASONING_EFFORT ? { reasoning_effort: process.env.AI_REASONING_EFFORT } : {};

/** Target per level untuk 100 simulasi, dalam item bank (soal, atau teks untuk reading). */
// Listening: 100 simulasi = 3000 dialog pendek (1 soal per item), 200 dialog panjang dan 200 monolog (sekitar 5 soal per item).
const BASE_TARGET: Record<Kind, number> = { structure: 1500, written: 2500, reading: 500, "listen-short": 3000, "listen-long": 200, "listen-lecture": 200 };
const BANDS = (process.env.BANK_LEVELS?.split(",").map((s) => s.trim()) ?? ALL_BANDS) as LevelBand[];

const targetOf = (kind: Kind) => Math.ceil(BASE_TARGET[kind] * SCALE);
const RUN_KINDS = (process.env.BANK_KINDS?.split(",").map((s) => s.trim()) ?? KINDS).filter((kind): kind is Kind => (KINDS as string[]).includes(kind));

const slot = (kind: Kind, band: LevelBand) => `${kind}|${band}`;

async function main() {
  const config = { ...(await getAiConfig()), ...(process.env.AI_MODEL ? { model: process.env.AI_MODEL } : {}) };
  if (!aiConfigured(config)) {
    console.error("AI_API_KEY belum diisi (.env.local atau Pengaturan aplikasi).");
    process.exit(1);
  }
  setAiConcurrency(CONCURRENCY);
  console.log(`Model: ${config.model}; jenis: ${RUN_KINDS.join(",")}; level: ${BANDS.join(",")}; skala ${SCALE}; paralel ${CONCURRENCY}.`);

  const have = new Map<string, number>();
  for (const row of await db
    .select({ kind: questionBank.kind, band: questionBank.levelBand, n: count() })
    .from(questionBank)
    .where(eq(questionBank.track, "eptr"))
    .groupBy(questionBank.kind, questionBank.levelBand)) {
    have.set(`${row.kind}|${row.band}`, row.n);
  }

  const ctx = await createEprtContext(config, process.env.AI_REASONING_EFFORT ? EXTRA : undefined, { kinds: RUN_KINDS });
  const startedAt = Date.now();
  const overBudget = () => estimateCostUsd(config.model, ctx.usage) >= MAX_COST_USD;
  const inFlight = new Map<string, number>();
  let calls = 0;
  let failuresInRow = 0;
  let added = 0;
  let rejected = 0;

  const need = (kind: Kind, band: LevelBand) =>
    targetOf(kind) - (have.get(slot(kind, band)) ?? 0) - (inFlight.get(slot(kind, band)) ?? 0) * PER_CALL[kind];
  const nextTask = () =>
    RUN_KINDS.flatMap((kind) => BANDS.map((band) => ({ kind, band, ratio: need(kind, band) / targetOf(kind) })))
      .filter((task) => task.ratio > 0)
      .sort((a, b) => b.ratio - a.ratio || Math.random() - 0.5)[0];

  async function runOne(kind: Kind, band: LevelBand) {
    const { n, dropped } = await generateEprtBatch(ctx, kind, band);
    have.set(slot(kind, band), (have.get(slot(kind, band)) ?? 0) + n);
    added += n;
    rejected += dropped;
    return { n, dropped };
  }

  async function worker() {
    while (calls < MAX_CALLS && failuresInRow < MAX_FAILURES_IN_ROW && !overBudget()) {
      const task = nextTask();
      if (!task) return;
      const { kind, band } = task;
      calls += 1;
      inFlight.set(slot(kind, band), (inFlight.get(slot(kind, band)) ?? 0) + 1);
      try {
        const { n, dropped } = await runOne(kind, band);
        failuresInRow = 0;
        console.log(`+ ${kind}/${band}: ${n} item (dibuang saat verifikasi: ${dropped}); ${have.get(slot(kind, band))}/${targetOf(kind)}`);
        if (calls % 10 === 0) {
          const minutes = (Date.now() - startedAt) / 60_000;
          const left = RUN_KINDS.flatMap((k) => BANDS.map((b) => Math.max(0, need(k, b)))).reduce((sum, value) => sum + value, 0);
          console.log(`  ~ ${(added / minutes).toFixed(1)} item/menit; sisa ${left} item (sekitar ${Math.round(left / Math.max(added / minutes, 0.01))} menit); biaya sejauh ini $${estimateCostUsd(config.model, ctx.usage).toFixed(2)}`);
        }
      } catch (error) {
        failuresInRow += 1;
        console.error(`! ${kind}/${band}:`, error instanceof Error ? error.message : error);
        await new Promise((resolve) => setTimeout(resolve, 5_000)); // jeda supaya gangguan sesaat gateway tidak menghabiskan percobaan
      } finally {
        inFlight.set(slot(kind, band), (inFlight.get(slot(kind, band)) ?? 1) - 1);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nSelesai. Ditambah ${added} item dalam ${calls} panggilan; ${rejected} soal dibuang saat verifikasi.`);
  console.log(`Token: ${ctx.usage.promptTokens} masuk, ${ctx.usage.completionTokens} keluar. Perkiraan biaya: $${estimateCostUsd(config.model, ctx.usage).toFixed(4)} (model ${config.model}).`);
  if (failuresInRow >= MAX_FAILURES_IN_ROW) console.error("Berhenti: terlalu banyak kegagalan berturut-turut. Cek key/saldo/model.");
  if (overBudget()) console.error(`Berhenti: perkiraan biaya melewati MAX_COST_USD ($${MAX_COST_USD}). Jalankan ulang untuk melanjutkan.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
