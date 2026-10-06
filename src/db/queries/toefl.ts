import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { eprtSimulations, toeflReviews, toeflSessions, type ToeflSession } from "@/db/schema";

export type Track = "toefl" | "eptr";

export async function listToeflSessions(userId: number, limit = 30, track: Track = "toefl") {
  return db
    .select()
    .from(toeflSessions)
    .where(and(eq(toeflSessions.userId, userId), eq(toeflSessions.track, track)))
    .orderBy(desc(toeflSessions.id))
    .limit(limit);
}

export async function getToeflSession(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(toeflSessions)
    .where(and(eq(toeflSessions.id, id), eq(toeflSessions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createToeflSession(values: {
  userId: number;
  track: Track;
  section: ToeflSession["section"];
  label: string;
  passage: string | null;
  questions: string;
  questionCount: number;
  simulationId?: number;
  progress?: string;
}) {
  const { questionCount, ...rest } = values;
  const answers = JSON.stringify(Array.from({ length: questionCount }, () => null));
  const [row] = await db
    .insert(toeflSessions)
    .values({ ...rest, answers })
    .returning();
  return row;
}

export async function updateToeflSession(
  id: number,
  values: {
    answers?: string;
    questions?: string;
    passage?: string | null;
    progress?: string;
    completedAt?: string | null;
    score?: number | null;
  },
) {
  await db.update(toeflSessions).set(values).where(eq(toeflSessions.id, id));
}

export async function listStandaloneSessions(userId: number, limit: number, track: Track) {
  return db
    .select()
    .from(toeflSessions)
    .where(
      and(
        eq(toeflSessions.userId, userId),
        eq(toeflSessions.track, track),
        isNull(toeflSessions.simulationId),
      ),
    )
    .orderBy(desc(toeflSessions.id))
    .limit(limit);
}

export async function deleteToeflSession(id: number) {
  await db.delete(toeflSessions).where(eq(toeflSessions.id, id));
}

export async function listSimulationSessions(userId: number, simulationId: number) {
  return db
    .select()
    .from(toeflSessions)
    .where(and(eq(toeflSessions.userId, userId), eq(toeflSessions.simulationId, simulationId)));
}

export async function createSimulation(userId: number, parts: string) {
  const [row] = await db.insert(eprtSimulations).values({ userId, parts }).returning();
  return row;
}

export async function getSimulation(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(eprtSimulations)
    .where(and(eq(eprtSimulations.id, id), eq(eprtSimulations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listSimulations(userId: number, limit = 10) {
  return db
    .select()
    .from(eprtSimulations)
    .where(eq(eprtSimulations.userId, userId))
    .orderBy(desc(eprtSimulations.id))
    .limit(limit);
}

export async function updateSimulation(
  id: number,
  values: { parts?: string; score?: string | null; completedAt?: string | null; timers?: string },
) {
  await db.update(eprtSimulations).set(values).where(eq(eprtSimulations.id, id));
}

/**
 * Isi slot bagian `index` secara atomik, hanya kalau masih kosong. Aman dipanggil
 * paralel untuk bagian berbeda: tiap update hanya menyentuh slotnya sendiri.
 * Mengembalikan true kalau slot berhasil diklaim.
 */
export async function claimSimulationPart(id: number, index: number, sessionId: number) {
  const path = `$[${index}]`;
  const rows = await db
    .update(eprtSimulations)
    .set({ parts: sql`json_set(${eprtSimulations.parts}, ${path}, ${sessionId})` })
    .where(
      and(
        eq(eprtSimulations.id, id),
        sql`json_extract(${eprtSimulations.parts}, ${path}) is null`,
      ),
    )
    .returning({ id: eprtSimulations.id });
  return rows.length > 0;
}

export async function listDueReviews(userId: number, today: string, limit = 15) {
  return db
    .select()
    .from(toeflReviews)
    .where(and(eq(toeflReviews.userId, userId), lte(toeflReviews.dueAt, today)))
    .orderBy(asc(toeflReviews.dueAt), asc(toeflReviews.id))
    .limit(limit);
}

export async function countReviews(userId: number, today: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      due: sql<number>`coalesce(sum(case when ${toeflReviews.dueAt} <= ${today} then 1 else 0 end), 0)`,
    })
    .from(toeflReviews)
    .where(eq(toeflReviews.userId, userId));
  return { total: Number(row?.total ?? 0), due: Number(row?.due ?? 0) };
}

export async function getReview(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(toeflReviews)
    .where(and(eq(toeflReviews.id, id), eq(toeflReviews.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createReview(values: {
  userId: number;
  question: string;
  box: number;
  dueAt: string;
}) {
  await db.insert(toeflReviews).values(values);
}

export async function updateReview(id: number, values: { box: number; dueAt: string }) {
  await db.update(toeflReviews).set(values).where(eq(toeflReviews.id, id));
}

export async function deleteReview(id: number) {
  await db.delete(toeflReviews).where(eq(toeflReviews.id, id));
}
