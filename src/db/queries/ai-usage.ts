import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiUsage, users } from "@/db/schema";
import { estimateCostUsd, type TokenUsage } from "@/lib/ai-pricing";
import { todayISO } from "@/lib/srs";

export type AiFeature = "tutor" | "toefl" | "eptr" | "writing" | "grammar";

export async function logAiUsage(values: {
  userId: number;
  feature: AiFeature;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
  ok: boolean;
  date?: string;
}) {
  const cost = estimateCostUsd(values.model, values.usage);
  await db.insert(aiUsage).values({
    userId: values.userId,
    feature: values.feature,
    model: values.model,
    promptTokens: values.usage.promptTokens,
    completionTokens: values.usage.completionTokens,
    totalTokens: values.usage.totalTokens,
    costUsd: cost.toFixed(6),
    latencyMs: values.latencyMs,
    ok: values.ok,
    date: values.date ?? todayISO(),
  });
}

/** Jumlah panggilan AI pembuat soal (TOEFL + EPrT) milik pengguna hari ini. */
export async function countQuestionCallsToday(userId: number, date: string = todayISO()) {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        eq(aiUsage.date, date),
        sql`${aiUsage.feature} in ('toefl', 'eptr')`,
      ),
    );
  return Number(row?.n ?? 0);
}

export type UsageTotals = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  errors: number;
};

const EMPTY_TOTALS: UsageTotals = {
  requests: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  costUsd: 0,
  avgLatencyMs: 0,
  errors: 0,
};

function toTotals(row?: {
  requests?: number | null;
  prompt?: number | null;
  completion?: number | null;
  total?: number | null;
  cost?: number | null;
  latency?: number | null;
  errors?: number | null;
}): UsageTotals {
  if (!row) return { ...EMPTY_TOTALS };
  const requests = Number(row.requests ?? 0);
  return {
    requests,
    promptTokens: Number(row.prompt ?? 0),
    completionTokens: Number(row.completion ?? 0),
    totalTokens: Number(row.total ?? 0),
    costUsd: Number(row.cost ?? 0),
    avgLatencyMs: requests ? Math.round(Number(row.latency ?? 0) / requests) : 0,
    errors: Number(row.errors ?? 0),
  };
}

const TOTALS_SELECT = {
  requests: sql<number>`count(*)`,
  prompt: sql<number>`coalesce(sum(${aiUsage.promptTokens}), 0)`,
  completion: sql<number>`coalesce(sum(${aiUsage.completionTokens}), 0)`,
  total: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
  cost: sql<number>`coalesce(sum(cast(${aiUsage.costUsd} as real)), 0)`,
  latency: sql<number>`coalesce(sum(${aiUsage.latencyMs}), 0)`,
  errors: sql<number>`coalesce(sum(case when ${aiUsage.ok} = 0 then 1 else 0 end), 0)`,
};

export async function usageOverview(sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  const today = todayISO();

  const [allTime] = await db.select(TOTALS_SELECT).from(aiUsage);
  const [window] = await db
    .select(TOTALS_SELECT)
    .from(aiUsage)
    .where(gte(aiUsage.date, since));
  const [todayRow] = await db
    .select(TOTALS_SELECT)
    .from(aiUsage)
    .where(eq(aiUsage.date, today));

  const byFeature = await db
    .select({ feature: aiUsage.feature, ...TOTALS_SELECT })
    .from(aiUsage)
    .where(gte(aiUsage.date, since))
    .groupBy(aiUsage.feature);

  const byDay = await db
    .select({ date: aiUsage.date, ...TOTALS_SELECT })
    .from(aiUsage)
    .where(gte(aiUsage.date, since))
    .groupBy(aiUsage.date)
    .orderBy(aiUsage.date);

  const perUser = await db
    .select({
      userId: aiUsage.userId,
      username: users.username,
      ...TOTALS_SELECT,
    })
    .from(aiUsage)
    .innerJoin(users, eq(users.id, aiUsage.userId))
    .where(gte(aiUsage.date, since))
    .groupBy(aiUsage.userId, users.username)
    .orderBy(desc(sql`coalesce(sum(${aiUsage.totalTokens}), 0)`));

  const recent = await db
    .select({
      id: aiUsage.id,
      userId: aiUsage.userId,
      username: users.username,
      feature: aiUsage.feature,
      model: aiUsage.model,
      totalTokens: aiUsage.totalTokens,
      costUsd: aiUsage.costUsd,
      latencyMs: aiUsage.latencyMs,
      ok: aiUsage.ok,
      date: aiUsage.date,
      createdAt: aiUsage.createdAt,
    })
    .from(aiUsage)
    .innerJoin(users, eq(users.id, aiUsage.userId))
    .orderBy(desc(aiUsage.id))
    .limit(25);

  const [activeUsers] = await db
    .select({ n: sql<number>`count(distinct ${aiUsage.userId})` })
    .from(aiUsage)
    .where(gte(aiUsage.date, since));

  const [activeToday] = await db
    .select({ n: sql<number>`count(distinct ${aiUsage.userId})` })
    .from(aiUsage)
    .where(eq(aiUsage.date, today));

  return {
    since,
    today,
    allTime: toTotals(allTime),
    window: toTotals(window),
    todayTotals: toTotals(todayRow),
    activeUsers: Number(activeUsers?.n ?? 0),
    activeToday: Number(activeToday?.n ?? 0),
    byFeature: byFeature.map((row) => ({ feature: row.feature, totals: toTotals(row) })),
    byDay: byDay.map((row) => ({ date: row.date, totals: toTotals(row) })),
    perUser: perUser.map((row) => ({
      userId: row.userId,
      username: row.username,
      totals: toTotals(row),
    })),
    recent: recent.map((row) => ({
      id: row.id,
      username: row.username,
      feature: row.feature,
      model: row.model,
      totalTokens: row.totalTokens,
      costUsd: Number(row.costUsd),
      latencyMs: row.latencyMs,
      ok: row.ok,
      date: row.date,
      createdAt: row.createdAt,
    })),
  };
}

export type UsageOverview = Awaited<ReturnType<typeof usageOverview>>;

export async function userActivitySummary(sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
      requests: sql<number>`count(${aiUsage.id})`,
      tokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)`,
      cost: sql<number>`coalesce(sum(cast(${aiUsage.costUsd} as real)), 0)`,
      lastActive: sql<string | null>`max(${aiUsage.createdAt})`,
    })
    .from(users)
    .leftJoin(
      aiUsage,
      and(eq(aiUsage.userId, users.id), gte(aiUsage.date, since)),
    )
    .groupBy(users.id, users.username, users.role, users.createdAt)
    .orderBy(desc(sql`coalesce(sum(${aiUsage.totalTokens}), 0)`));

  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    role: row.role,
    createdAt: row.createdAt,
    requests: Number(row.requests ?? 0),
    tokens: Number(row.tokens ?? 0),
    costUsd: Number(row.cost ?? 0),
    lastActive: row.lastActive,
  }));
}
