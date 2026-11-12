import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  activityLog,
  aiUsage,
  dataRequests,
  users,
  userSettings,
  vocabularyProgress,
  writingSubmissions,
  xpEvents,
} from "@/db/schema";

/* ═══ Admin: daftar siswa dengan metrik ringkas ═══ */
export type StudentRow = {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  createdAt: string;
  xpTotal: number;
  vocabMastered: number;
  lastActive: string | null;
  aiCostUsd: number;
};

export async function listStudents(): Promise<StudentRow[]> {
  const rows = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(desc(users.createdAt));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [xpRows, vocabRows, lastRows, costRows] = await Promise.all([
    db
      .select({ userId: xpEvents.userId, total: sql<number>`coalesce(sum(${xpEvents.amount}),0)` })
      .from(xpEvents)
      .where(inArray(xpEvents.userId, ids))
      .groupBy(xpEvents.userId),
    db
      .select({ userId: vocabularyProgress.userId, n: sql<number>`count(*)` })
      .from(vocabularyProgress)
      .where(and(inArray(vocabularyProgress.userId, ids), gte(vocabularyProgress.box, 5)))
      .groupBy(vocabularyProgress.userId),
    db
      .select({ userId: activityLog.userId, last: sql<string>`max(${activityLog.date})` })
      .from(activityLog)
      .where(inArray(activityLog.userId, ids))
      .groupBy(activityLog.userId),
    db
      .select({ userId: aiUsage.userId, cost: sql<string>`coalesce(sum(cast(${aiUsage.costUsd} as real)),0)` })
      .from(aiUsage)
      .where(inArray(aiUsage.userId, ids))
      .groupBy(aiUsage.userId),
  ]);

  const xpMap = new Map(xpRows.map((r) => [r.userId, Number(r.total)]));
  const vocabMap = new Map(vocabRows.map((r) => [r.userId, Number(r.n)]));
  const lastMap = new Map(lastRows.map((r) => [r.userId, r.last]));
  const costMap = new Map(costRows.map((r) => [r.userId, Number(r.cost)]));

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    createdAt: row.createdAt,
    xpTotal: xpMap.get(row.id) ?? 0,
    vocabMastered: vocabMap.get(row.id) ?? 0,
    lastActive: lastMap.get(row.id) ?? null,
    aiCostUsd: costMap.get(row.id) ?? 0,
  }));
}

/* ═══ Ekspor data (UU PDP) ═══ */
export async function exportUserData(userId: number) {
  const [vocab, writing, activity, settings, xp] = await Promise.all([
    db.select().from(vocabularyProgress).where(eq(vocabularyProgress.userId, userId)),
    db.select().from(writingSubmissions).where(eq(writingSubmissions.userId, userId)),
    db.select().from(activityLog).where(eq(activityLog.userId, userId)),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)),
    db.select().from(xpEvents).where(eq(xpEvents.userId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    vocabularyProgress: vocab,
    writingSubmissions: writing,
    activity,
    xpEvents: xp,
    userSettings: settings,
  };
}

/** Catat permintaan hak subjek data (ekspor/hapus) agar terlihat di panel admin. */
export async function recordDataRequest(userId: number, kind: "export" | "delete") {
  await db.insert(dataRequests).values({ userId, kind, status: "done" });
}