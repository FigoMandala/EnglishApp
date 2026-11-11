import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  grammarLessonProgress,
  grammarLessons,
  learningUnitItems,
  learningUnitProgress,
  learningUnits,
  xpEvents,
  type LearningUnit,
} from "@/db/schema";

export type UnitWithItems = LearningUnit & {
  items: (typeof learningUnitItems.$inferSelect)[];
};

export async function listUnitsWithItems(): Promise<UnitWithItems[]> {
  const units = await db
    .select()
    .from(learningUnits)
    .where(eq(learningUnits.published, true))
    .orderBy(asc(learningUnits.orderIndex), asc(learningUnits.id));
  if (units.length === 0) return [];

  const items = await db
    .select()
    .from(learningUnitItems)
    .orderBy(asc(learningUnitItems.orderIndex), asc(learningUnitItems.id));

  return units.map((unit) => ({
    ...unit,
    items: items.filter((item) => item.unitId === unit.id),
  }));
}

export async function getUnitBySlug(slug: string) {
  const [unit] = await db
    .select()
    .from(learningUnits)
    .where(eq(learningUnits.slug, slug))
    .limit(1);
  if (!unit) return null;
  const items = await db
    .select()
    .from(learningUnitItems)
    .where(eq(learningUnitItems.unitId, unit.id))
    .orderBy(asc(learningUnitItems.orderIndex), asc(learningUnitItems.id));
  return { ...unit, items };
}

export async function getUnitById(unitId: number) {
  const [unit] = await db
    .select()
    .from(learningUnits)
    .where(eq(learningUnits.id, unitId))
    .limit(1);
  return unit ?? null;
}

export async function completedUnitIds(userId: number): Promise<Set<number>> {
  const rows = await db
    .select({ unitId: learningUnitProgress.unitId })
    .from(learningUnitProgress)
    .where(
      and(
        eq(learningUnitProgress.userId, userId),
        sql`${learningUnitProgress.completedAt} is not null`,
      ),
    );
  return new Set(rows.map((row) => row.unitId));
}

export async function isUnitCompleted(userId: number, unitId: number) {
  const [row] = await db
    .select({ completedAt: learningUnitProgress.completedAt })
    .from(learningUnitProgress)
    .where(
      and(eq(learningUnitProgress.userId, userId), eq(learningUnitProgress.unitId, unitId)),
    )
    .limit(1);
  return Boolean(row?.completedAt);
}

/**
 * Jumlah materi grammar pada unit yang belum diselesaikan pengguna (belum
 * ada baris progres dengan completedAt). Dipakai sebagai syarat bonus XP
 * "unit selesai" supaya completeUnitAction tidak bisa dipanggil langsung
 * untuk unit yang belum dikerjakan (audit keamanan P1).
 */
export async function countUnitIncompleteLessons(userId: number, unitId: number) {
  const rows = await db
    .select({ id: grammarLessons.id })
    .from(learningUnitItems)
    .innerJoin(
      grammarLessons,
      and(
        eq(grammarLessons.slug, sql`${learningUnitItems.refSlug}`),
        eq(grammarLessons.published, true),
      ),
    )
    .leftJoin(
      grammarLessonProgress,
      and(
        eq(grammarLessonProgress.lessonId, grammarLessons.id),
        eq(grammarLessonProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(learningUnitItems.unitId, unitId),
        eq(learningUnitItems.kind, "grammar"),
        sql`${grammarLessonProgress.completedAt} is null`,
      ),
    );
  return rows.length;
}

export async function completeUnit(userId: number, unitId: number) {
  const [existing] = await db
    .select()
    .from(learningUnitProgress)
    .where(
      and(eq(learningUnitProgress.userId, userId), eq(learningUnitProgress.unitId, unitId)),
    )
    .limit(1);

  if (existing) {
    if (existing.completedAt) return false;
    await db
      .update(learningUnitProgress)
      .set({ completedAt: sql`(datetime('now'))` })
      .where(eq(learningUnitProgress.id, existing.id));
    return true;
  }

  // Dua klik paralel bisa sama-sama lolos cek di atas; yang kalah dilarikan
  // ke jalur update oleh onConflictDoNothing (unique user+unit).
  const [inserted] = await db
    .insert(learningUnitProgress)
    .values({ userId, unitId, completedAt: sql`(datetime('now'))` })
    .onConflictDoNothing()
    .returning({ id: learningUnitProgress.id });
  if (inserted) return true;

  const [row] = await db
    .select({ completedAt: learningUnitProgress.completedAt })
    .from(learningUnitProgress)
    .where(
      and(eq(learningUnitProgress.userId, userId), eq(learningUnitProgress.unitId, unitId)),
    )
    .limit(1);
  if (row?.completedAt) return false;
  await db
    .update(learningUnitProgress)
    .set({ completedAt: sql`(datetime('now'))` })
    .where(
      and(eq(learningUnitProgress.userId, userId), eq(learningUnitProgress.unitId, unitId)),
    );
  return true;
}

export type UnitState = "done" | "current" | "locked";

/** Tentukan status tiap unit: selesai, sedang dibuka, atau terkunci. */
export function unitStates(unitIds: number[], completed: Set<number>): Map<number, UnitState> {
  const states = new Map<number, UnitState>();
  let unlockedNext = true;
  for (const id of unitIds) {
    if (completed.has(id)) {
      states.set(id, "done");
    } else if (unlockedNext) {
      states.set(id, "current");
      unlockedNext = false;
    } else {
      states.set(id, "locked");
    }
  }
  return states;
}

/** Peta jalur: daftar unit beserta status untuk seorang pengguna. */
export async function learningPath(userId: number) {
  const units = await listUnitsWithItems();
  const completed = await completedUnitIds(userId);
  const states = unitStates(units.map((unit) => unit.id), completed);

  return units.map((unit) => ({
    ...unit,
    state: states.get(unit.id) ?? ("locked" as UnitState),
  }));
}

export async function addXp(userId: number, amount: number, reason: string, date: string) {
  await db.insert(xpEvents).values({ userId, amount, reason, date });
}

/**
 * Tambah XP dengan batas harian per-reason secara atomik: syarat kuota
 * dievaluasi di statement INSERT yang sama, jadi dua submit paralel tidak
 * bisa sama-sama lolos cek baca-lalu-tulis (TOCTOU) dan menembus cap.
 * Mengembalikan jumlah yang benar-benar ditulis (0 kalau kuota penuh).
 */
export async function addCappedXp(
  userId: number,
  reason: string,
  date: string,
  want: number,
  cap: number,
): Promise<number> {
  const attempt = async (amount: number): Promise<number> => {
    if (amount <= 0) return 0;
    const result = await db.run(sql`
      insert into xp_events (user_id, amount, reason, date)
      select ${userId}, ${amount}, ${reason}, ${date}
      where (
        select coalesce(sum(amount), 0) from xp_events
        where user_id = ${userId} and reason = ${reason} and date = ${date}
      ) + ${amount} <= ${cap}
    `);
    return result.rowsAffected > 0 ? amount : 0;
  };

  const granted = await attempt(want);
  if (granted > 0) return granted;

  // Kuota tidak cukup untuk `want` penuh: coba sisa ruangnya (perilaku lama
  // memberi XP parsial di ujung cap).
  const [earned] = await db
    .select({ n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), eq(xpEvents.reason, reason), eq(xpEvents.date, date)));
  const room = Math.max(0, cap - Number(earned?.n ?? 0));
  return attempt(Math.min(want, room));
}

export async function totalXp(userId: number) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId));
  return Number(row?.n ?? 0);
}

export async function xpOnDate(userId: number, date: string) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), eq(xpEvents.date, date)));
  return Number(row?.n ?? 0);
}

export async function xpByDay(userId: number, rangeStart: string, rangeEnd: string) {
  const rows = await db
    .select({ date: xpEvents.date, n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, userId),
        sql`${xpEvents.date} >= ${rangeStart}`,
        sql`${xpEvents.date} <= ${rangeEnd}`,
      ),
    )
    .groupBy(xpEvents.date);
  return new Map(rows.map((row) => [row.date, Number(row.n ?? 0)]));
}