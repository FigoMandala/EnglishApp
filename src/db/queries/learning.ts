import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
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

  await db
    .insert(learningUnitProgress)
    .values({ userId, unitId, completedAt: sql`(datetime('now'))` });
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