import { and, count, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { activityLog, users } from "@/db/schema";

import { shiftDate, todayISO } from "./srs";

/**
 * North star metric: kata dikuasai per minggu (proxy dari box >= 5).
 * Plus retensi D1/D7/D30 sederhana berbasis activity_log.
 */
export type LearnerMetrics = {
  wordsMasteredWeek: number;
  activeToday: number;
  activeWeek: number;
  d1: number;
  d7: number;
  d30: number;
};

export async function wordsMasteredThisWeek(userId: number): Promise<number> {
  const since = shiftDate(todayISO(), -6);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(sql`vocabulary_progress`)
    .where(sql`user_id = ${userId} and box >= 5 and last_reviewed_at >= ${since}`);
  return Number(row?.n ?? 0);
}

/** Hitung user aktif dalam N hari terakhir. */
async function activeSince(date: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${activityLog.userId})` })
    .from(activityLog)
    .where(gte(activityLog.date, date));
  return Number(row?.n ?? 0);
}

/**
 * Retensi sederhana: dari user yang mendaftar pada hari H, berapa persen
 * masih aktif di hari H+1/H+7/H+30.
 */
async function retention(dayOffset: number): Promise<number> {
  const today = todayISO();
  const cohortStart = shiftDate(today, -dayOffset - 1);
  const cohortEnd = shiftDate(today, -dayOffset);

  const cohort = await db
    .select({ id: users.id, createdAt: users.createdAt })
    .from(users)
    .where(and(gte(sql`substr(${users.createdAt}, 1, 10)`, cohortStart), sql`substr(${users.createdAt},1,10) <= ${cohortEnd}`));

  if (cohort.length === 0) return 0;

  const cohortIds = cohort.map((u) => u.id);
  const active = await db
    .select({ userId: activityLog.userId })
    .from(activityLog)
    .where(and(gte(activityLog.date, cohortEnd), inArray(activityLog.userId, cohortIds)))
    .groupBy(activityLog.userId);

  return Math.round((active.length / cohort.length) * 100);
}

export async function learnerMetrics(): Promise<LearnerMetrics> {
  const today = todayISO();
  const [activeToday, activeWeek, d1, d7, d30] = await Promise.all([
    activeSince(today),
    activeSince(shiftDate(today, -6)),
    retention(1),
    retention(7),
    retention(30),
  ]);

  const [words] = await db
    .select({ n: sql<number>`count(*)` })
    .from(sql`vocabulary_progress`)
    .where(sql`box >= 5 and last_reviewed_at >= ${shiftDate(today, -6)}`);

  return {
    wordsMasteredWeek: Number(words?.n ?? 0),
    activeToday,
    activeWeek,
    d1,
    d7,
    d30,
  };
}

export async function totalUsers(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(users);
  return Number(row?.n ?? 0);
}