import { and, asc, eq, gte, inArray, max, min, notInArray, sql } from "drizzle-orm";

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

/** Jumlah titik awal acak per pemilihan; tiap titik memberi irisan kecil berurutan. */
const PICK_POINTS = 6;

/**
 * Item acak yang belum pernah dilihat pengguna ini. Tanpa `order by random()` (mengurut seluruh irisan,
 * 1,2 detik pada 300.000 baris): beberapa titik awal acak di rentang id irisan (jenis + level), tiap titik
 * mengambil beberapa item berurutan lewat indeks. Hasil diacak ulang di memori.
 *
 * shortcut: item yang bersebelahan di id biasanya dibuat dalam satu batch; enam titik acak membuat
 * campurannya tetap beragam. Kalau irisan kecil/sisa soal belum dilihat sedikit, ada pengambilan lanjutan
 * dari awal irisan.
 */
export async function pickUnseenItems(
  userId: number,
  track: "toefl" | "eptr",
  kind: string,
  band: LevelBand,
  limit: number,
  skill?: string,
) {
  const slice = and(
    eq(questionBank.track, track),
    eq(questionBank.kind, kind),
    eq(questionBank.levelBand, band),
    skill ? eq(questionBank.skill, skill) : undefined,
  );
  const [range] = await db
    .select({ lo: min(questionBank.id), hi: max(questionBank.id) })
    .from(questionBank)
    .where(slice);
  if (range?.lo == null || range.hi == null) return [];

  const seen = db
    .select({ fingerprint: questionSeen.fingerprint })
    .from(questionSeen)
    .where(eq(questionSeen.userId, userId));
  const unseen = and(slice, notInArray(questionBank.fingerprint, seen));
  const span = range.hi - range.lo + 1;
  const per = Math.ceil(limit / PICK_POINTS) + 2;

  const batches = await Promise.all(
    Array.from({ length: PICK_POINTS }, () => {
      const start = range.lo! + Math.floor(Math.random() * span);
      return db.select().from(questionBank).where(and(unseen, gte(questionBank.id, start))).orderBy(asc(questionBank.id)).limit(per);
    }),
  );
  const picked = new Map<number, (typeof batches)[number][number]>();
  for (const row of batches.flat()) picked.set(row.id, row);

  // Titik acak jatuh dekat ujung irisan atau banyak yang sudah dilihat: lengkapi dari awal irisan.
  if (picked.size < limit) {
    const more = await db
      .select()
      .from(questionBank)
      .where(and(unseen, gte(questionBank.id, range.lo)))
      .orderBy(asc(questionBank.id))
      .limit(limit);
    for (const row of more) if (picked.size < limit * 2) picked.set(row.id, row);
  }

  const rows = [...picked.values()];
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows.slice(0, limit);
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
