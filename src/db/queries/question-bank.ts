import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { questionBank, questionSeen, questionStats, sqliteNow } from "@/db/schema";

export type LevelBand = "low" | "mid" | "high";

export function levelBand(level: number): LevelBand {
  if (level <= 450) return "low";
  if (level <= 550) return "mid";
  return "high";
}

export type BankRow = typeof questionBank.$inferSelect;

export async function saveBankItems(
  items: {
    track: "toefl" | "eptr";
    kind: string;
    levelBand: LevelBand;
    fingerprint: string;
    skill: string | null;
    questionCount: number;
    item: string;
  }[],
) {
  if (!items.length) return;
  await db.insert(questionBank).values(items).onConflictDoNothing();
}

/** Item acak yang belum pernah dilihat pengguna ini. */
export async function pickUnseenItems(
  userId: number,
  track: "toefl" | "eptr",
  kind: string,
  band: LevelBand,
  limit: number,
  skill?: string,
) {
  const seen = db
    .select({ fingerprint: questionSeen.fingerprint })
    .from(questionSeen)
    .where(eq(questionSeen.userId, userId));
  return db
    .select()
    .from(questionBank)
    .where(
      and(
        eq(questionBank.track, track),
        eq(questionBank.kind, kind),
        eq(questionBank.levelBand, band),
        notInArray(questionBank.fingerprint, seen),
        skill ? eq(questionBank.skill, skill) : undefined,
      ),
    )
    .orderBy(sql`random()`)
    .limit(limit);
}

/** Catat satu jawaban untuk kalibrasi; soal baru otomatis dibuatkan barisnya. */
export async function recordAnswerStat(entry: {
  fingerprint: string;
  track: "toefl" | "eptr";
  kind: string;
  skill: string | null;
  levelBand: LevelBand;
  correct: boolean;
}) {
  const hit = entry.correct ? 1 : 0;
  await db
    .insert(questionStats)
    .values({
      fingerprint: entry.fingerprint,
      track: entry.track,
      kind: entry.kind,
      skill: entry.skill,
      levelBand: entry.levelBand,
      attempts: 1,
      correct: hit,
    })
    .onConflictDoUpdate({
      target: [questionStats.track, questionStats.fingerprint],
      set: {
        attempts: sql`${questionStats.attempts} + 1`,
        correct: sql`${questionStats.correct} + ${hit}`,
        updatedAt: sqliteNow(),
      },
    });
}

export async function getQuestionStats(track: "toefl" | "eptr", fingerprints: string[]) {
  if (!fingerprints.length) return new Map<string, { attempts: number; correct: number }>();
  const rows = await db
    .select({
      fingerprint: questionStats.fingerprint,
      attempts: questionStats.attempts,
      correct: questionStats.correct,
    })
    .from(questionStats)
    .where(and(eq(questionStats.track, track), inArray(questionStats.fingerprint, fingerprints)));
  return new Map(rows.map((row) => [row.fingerprint, row]));
}

export async function listQuestionStats(track: "toefl" | "eptr") {
  return db.select().from(questionStats).where(eq(questionStats.track, track));
}

export async function markSeen(userId: number, fingerprints: string[]) {
  if (!fingerprints.length) return;
  await db
    .insert(questionSeen)
    .values(fingerprints.map((fingerprint) => ({ userId, fingerprint })))
    .onConflictDoNothing();
}
