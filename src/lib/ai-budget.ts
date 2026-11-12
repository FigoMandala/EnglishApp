import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiUsage, appConfig } from "@/db/schema";
import type { AiFeature } from "@/db/queries/ai-usage";

import { todayISO } from "./srs";
import { estimateCostUsd, type TokenUsage } from "./ai-pricing";

/**
 * Kill-switch anggaran AI harian. Kalau biaya hari ini melewati batas,
 * fitur AI non-esensial dihentikan supaya tidak rugi.
 * Batas diatur admin (app_config), lalu env AI_DAILY_BUDGET_USD, lalu default $5.
 */
const DEFAULT_BUDGET_USD = 5;
const BUDGET_KEY = "ai_daily_budget_usd";
export const BUDGET_MIN_USD = 1;
export const BUDGET_MAX_USD = 100;

function envBudgetUsd() {
  const raw = Number(process.env.AI_DAILY_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BUDGET_USD;
}

export async function dailyBudgetUsd() {
  const [row] = await db.select().from(appConfig).where(eq(appConfig.key, BUDGET_KEY)).limit(1);
  const stored = Number(row?.value);
  return Number.isFinite(stored) && stored > 0 ? stored : envBudgetUsd();
}

/** Validasi batas dari form admin. Mengembalikan pesan galat atau null. */
export function budgetError(value: number) {
  if (!Number.isFinite(value)) return "Batas harus berupa angka.";
  if (value < BUDGET_MIN_USD || value > BUDGET_MAX_USD) {
    return `Batas harus antara $${BUDGET_MIN_USD} dan $${BUDGET_MAX_USD}.`;
  }
  return null;
}

export async function setDailyBudgetUsd(value: number) {
  const text = String(Math.round(value * 100) / 100);
  await db
    .insert(appConfig)
    .values({ key: BUDGET_KEY, value: text })
    .onConflictDoUpdate({ target: appConfig.key, set: { value: text, updatedAt: sql`(datetime('now'))` } });
}

export async function spentTodayUsd(): Promise<number> {
  const today = todayISO();
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(cast(${aiUsage.costUsd} as real)), 0)`,
    })
    .from(aiUsage)
    .where(eq(aiUsage.date, today));
  return Number(row?.total ?? 0) || 0;
}

export type BudgetState = { allowed: boolean; spent: number; budget: number };

export async function checkBudget(): Promise<BudgetState> {
  const [spent, budget] = await Promise.all([spentTodayUsd(), dailyBudgetUsd()]);
  return { allowed: spent < budget, spent, budget };
}

/** Estimasi token per panggilan fitur, untuk menghitung biaya reservasi (konservatif). */
const RESERVE_TOKENS: Record<AiFeature, TokenUsage> = {
  tutor: { promptTokens: 2_500, completionTokens: 600, totalTokens: 3_100 },
  toefl: { promptTokens: 2_500, completionTokens: 1_800, totalTokens: 4_300 },
  eptr: { promptTokens: 2_500, completionTokens: 1_800, totalTokens: 4_300 },
  writing: { promptTokens: 2_000, completionTokens: 800, totalTokens: 2_800 },
  grammar: { promptTokens: 900, completionTokens: 400, totalTokens: 1_300 },
  content: { promptTokens: 2_000, completionTokens: 2_000, totalTokens: 4_000 },
};

/**
 * Gerbang budget atomik: sisipkan baris reservasi berbiaya estimasi hanya
 * kalau total biaya hari ini (termasuk reservasi paralel lain) masih di bawah
 * batas. Syarat dievaluasi di statement INSERT yang sama (idiom addCappedXp),
 * jadi N request paralel tidak bisa sama-sama lolos cek lalu menembus
 * anggaran seperti pada checkBudget yang check-then-act.
 *
 * Setelah panggilan provider selesai, pemanggil wajib menghapus reservasi
 * (releaseReservation) dan mencatat usage asli lewat logAiUsage — total
 * bersih tetap benar. Mengembalikan id reservasi, atau null kalau anggaran
 * sudah habis.
 */
export async function reserveBudget(
  userId: number,
  feature: AiFeature,
  model: string,
): Promise<number | null> {
  const today = todayISO();
  const budget = await dailyBudgetUsd();
  const estimate = estimateCostUsd(model, RESERVE_TOKENS[feature]);

  // Bersihkan reservasi yatim (proses mati sebelum sempat release) secara
  // berkala. Discriminator: reservasi punya latency 0, token 0, biaya > 0 —
  // baris usage asli tidak mungkin begitu sekaligus.
  if (Math.random() < 0.02) {
    await db
      .delete(aiUsage)
      .where(
        and(
          eq(aiUsage.latencyMs, 0),
          eq(aiUsage.totalTokens, 0),
          sql`cast(${aiUsage.costUsd} as real) > 0`,
          lt(aiUsage.createdAt, sql`datetime('now', '-1 hour')`),
        ),
      )
      .catch(() => undefined);
  }

  const result = await db.run(sql`
    insert into ai_usage (user_id, feature, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, ok, date)
    select ${userId}, ${feature}, ${model}, 0, 0, 0, ${estimate.toFixed(6)}, 0, 1, ${today}
    where (
      select coalesce(sum(cast(cost_usd as real)), 0) from ai_usage where date = ${today}
    ) + ${estimate} <= ${budget}
    returning id
  `);
  const id = Number((result.rows?.[0] as Record<string, unknown> | undefined)?.id ?? 0);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Hapus reservasi biaya setelah usage asli dicatat (atau panggilan gagal). */
export async function releaseReservation(id: number | null) {
  if (!id) return;
  await db.delete(aiUsage).where(eq(aiUsage.id, id)).catch(() => undefined);
}
