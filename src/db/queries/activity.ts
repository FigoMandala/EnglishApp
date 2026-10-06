import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { activityLog, userSettings } from "@/db/schema";
import { todayISO } from "@/lib/srs";

export type ActivityKind = "vocab" | "grammar" | "toefl" | "chat" | "writing";

export async function logActivity(
  userId: number,
  kind: ActivityKind,
  detail?: string | null,
  date: string = todayISO(),
) {
  await db.insert(activityLog).values({ userId, kind, date, detail: detail ?? null });
}

export async function listActivity(userId: number, limit = 30) {
  return db
    .select()
    .from(activityLog)
    .where(eq(activityLog.userId, userId))
    .orderBy(desc(activityLog.id))
    .limit(limit);
}

export async function activityByDay(userId: number, rangeStart: string, rangeEnd: string) {
  const rows = await db
    .select({ date: activityLog.date, kind: activityLog.kind, n: sql<number>`count(*)` })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        gte(activityLog.date, rangeStart),
        sql`${activityLog.date} <= ${rangeEnd}`,
      ),
    )
    .groupBy(activityLog.date, activityLog.kind);

  const byDate = new Map<string, { total: number; byKind: Partial<Record<ActivityKind, number>> }>();
  for (const row of rows) {
    const entry = byDate.get(row.date) ?? { total: 0, byKind: {} };
    entry.total += Number(row.n);
    entry.byKind[row.kind as ActivityKind] = Number(row.n);
    byDate.set(row.date, entry);
  }
  return byDate;
}

export async function studyDays(userId: number) {
  const rows = await db
    .selectDistinct({ date: activityLog.date })
    .from(activityLog)
    .where(eq(activityLog.userId, userId));
  return rows.map((row) => row.date);
}

export const SETTING_KEYS = {
  toeflTarget: "toefl_target",
  toeflTrend: "toefl_trend",
  eptrTarget: "eptr_target",
  eptrTrend: "eptr_trend",
  questionSeeds: "question_seeds",
} as const;

export async function getSetting<T>(userId: number, key: string, fallback: T): Promise<T> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(and(eq(userSettings.userId, userId), eq(userSettings.key, key)))
    .limit(1);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    console.error(`[settings] nilai "${key}" bukan JSON valid, memakai default.`);
    return fallback;
  }
}

export async function setSetting(userId: number, key: string, value: unknown) {
  const json = JSON.stringify(value);
  await db
    .insert(userSettings)
    .values({ userId, key, value: json })
    .onConflictDoUpdate({
      target: [userSettings.userId, userSettings.key],
      set: { value: json, updatedAt: sql`(datetime('now'))` },
    });
}

export type ToeflTarget = { score: number; testDate: string | null };
export type ToeflTrendPoint = { date: string; total: number };

export function getToeflTarget(userId: number) {
  return getSetting<ToeflTarget | null>(userId, SETTING_KEYS.toeflTarget, null);
}

export function getToeflTrend(userId: number) {
  return getSetting<ToeflTrendPoint[]>(userId, SETTING_KEYS.toeflTrend, []);
}

export function getEptrTarget(userId: number) {
  return getSetting<ToeflTarget | null>(userId, SETTING_KEYS.eptrTarget, null);
}

export function getEptrTrend(userId: number) {
  return getSetting<ToeflTrendPoint[]>(userId, SETTING_KEYS.eptrTrend, []);
}
