import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiUsage } from "@/db/schema";

import { todayISO } from "./srs";

/**
 * Kill-switch anggaran AI harian. Kalau biaya hari ini melewati batas,
 * fitur AI non-esensial dihentikan supaya tidak rugi.
 * Batas dikonfigurasi via env AI_DAILY_BUDGET_USD (default $5).
 */
const DEFAULT_BUDGET_USD = 5;

export function dailyBudgetUsd() {
  const raw = Number(process.env.AI_DAILY_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BUDGET_USD;
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
  const [spent, budget] = [await spentTodayUsd(), dailyBudgetUsd()];
  return { allowed: spent < budget, spent, budget };
}

/**
 * Router model: tugas ringan (grading grammar, soal struktur) pakai model
 * kecil, tugas berat (writing, tutor) pakai model utama.
 * Set AI_MODEL_LIGHT untuk menimpa.
 */
export type AiTask = "light" | "heavy";

export function modelFor(task: AiTask, primaryModel: string) {
  if (task === "light") {
    const light = process.env.AI_MODEL_LIGHT?.trim();
    if (light) return light;
    // Turunkan otomatis dari model utama kalau tidak diset.
    if (/gpt-4o(?!-mini)/i.test(primaryModel)) return "gpt-4o-mini";
    if (/gemini.*pro/i.test(primaryModel)) return "gemini-2.0-flash";
    if (/claude.*sonnet/i.test(primaryModel)) return "claude-3-5-haiku";
  }
  return primaryModel;
}

export async function costByFeatureToday(): Promise<{ feature: string; cost: number }[]> {
  const today = todayISO();
  const rows = await db
    .select({
      feature: aiUsage.feature,
      cost: sql<string>`coalesce(sum(cast(${aiUsage.costUsd} as real)), 0)`,
    })
    .from(aiUsage)
    .where(eq(aiUsage.date, today))
    .groupBy(aiUsage.feature);
  return rows.map((row) => ({ feature: row.feature, cost: Number(row.cost) || 0 }));
}

/** Dipakai halaman admin untuk audit biaya per user. */
export async function costByUser(limit = 20) {
  const rows = await db
    .select({
      userId: aiUsage.userId,
      cost: sql<string>`coalesce(sum(cast(${aiUsage.costUsd} as real)), 0)`,
      calls: sql<number>`count(*)`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.ok, true)))
    .groupBy(aiUsage.userId)
    .orderBy(sql`sum(cast(${aiUsage.costUsd} as real)) desc`)
    .limit(limit);
  return rows.map((row) => ({ userId: row.userId, cost: Number(row.cost) || 0, calls: Number(row.calls) || 0 }));
}