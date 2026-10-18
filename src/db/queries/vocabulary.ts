import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  vocabulary,
  vocabularyProgress,
  type NewVocabulary,
  type Vocabulary,
} from "@/db/schema";
import { nextReviewFsrs, shiftDate, todayISO, type ReviewGrade } from "@/lib/srs";

export type VocabularyCard = Vocabulary & {
  box: number;
  dueAt: string | null;
  reviewCount: number;
  correctCount: number;
  lastReviewedAt: string | null;
};

export type VocabularyFilter = { level?: Vocabulary["level"]; topic?: string; q?: string };

export async function listVocabulary(filter: VocabularyFilter = {}) {
  const rows = await db.select().from(vocabulary).orderBy(asc(vocabulary.word));
  const needle = filter.q?.trim().toLowerCase() ?? "";
  return rows
    .filter((row) => (filter.level ? row.level === filter.level : true))
    .filter((row) => (filter.topic ? row.topic === filter.topic : true))
    .filter((row) =>
      needle
        ? row.word.toLowerCase().includes(needle) || row.meaning.toLowerCase().includes(needle)
        : true,
    );
}

export type VocabularyInput = Omit<NewVocabulary, "wordLower"> & { wordLower?: string };

export async function createVocabulary(values: VocabularyInput) {
  const [row] = await db
    .insert(vocabulary)
    .values({ ...values, wordLower: values.word.trim().toLowerCase() })
    .returning();
  return row;
}

export async function updateVocabulary(id: number, values: Partial<NewVocabulary>) {
  await db
    .update(vocabulary)
    .set({
      ...values,
      ...(values.word ? { wordLower: values.word.trim().toLowerCase() } : {}),
    })
    .where(eq(vocabulary.id, id));
}

export async function deleteVocabulary(id: number) {
  await db.delete(vocabulary).where(eq(vocabulary.id, id));
}

export async function listVocabularyCards(userId: number): Promise<VocabularyCard[]> {
  const rows = await db
    .select({ word: vocabulary, progress: vocabularyProgress })
    .from(vocabulary)
    .leftJoin(
      vocabularyProgress,
      and(
        eq(vocabularyProgress.vocabularyId, vocabulary.id),
        eq(vocabularyProgress.userId, userId),
      ),
    )
    .orderBy(asc(vocabulary.word), asc(vocabulary.id));

  return rows.map(({ word, progress }) => ({
    ...word,
    box: progress?.box ?? 0,
    dueAt: progress?.dueAt ?? null,
    reviewCount: progress?.reviewCount ?? 0,
    correctCount: progress?.correctCount ?? 0,
    lastReviewedAt: progress?.lastReviewedAt ?? null,
  }));
}

/** Satu baris progress kartu untuk user tertentu (tanpa membuat baris baru). */
export async function getCardProgress(userId: number, vocabularyId: number) {
  const [row] = await db
    .select({
      box: vocabularyProgress.box,
      dueAt: vocabularyProgress.dueAt,
      reviewCount: vocabularyProgress.reviewCount,
    })
    .from(vocabularyProgress)
    .where(
      and(
        eq(vocabularyProgress.userId, userId),
        eq(vocabularyProgress.vocabularyId, vocabularyId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function ensureProgress(userId: number, vocabularyId: number) {
  const [existing] = await db
    .select()
    .from(vocabularyProgress)
    .where(
      and(
        eq(vocabularyProgress.userId, userId),
        eq(vocabularyProgress.vocabularyId, vocabularyId),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [row] = await db
    .insert(vocabularyProgress)
    .values({ userId, vocabularyId, dueAt: todayISO(), box: 0 })
    .returning();
  return row;
}

export async function listDueCards(userId: number, limit = 20): Promise<VocabularyCard[]> {
  const today = todayISO();
  const rows = await db
    .select({ word: vocabulary, progress: vocabularyProgress })
    .from(vocabulary)
    .leftJoin(
      vocabularyProgress,
      and(
        eq(vocabularyProgress.vocabularyId, vocabulary.id),
        eq(vocabularyProgress.userId, userId),
      ),
    )
    .where(
      or(isNull(vocabularyProgress.id), lte(vocabularyProgress.dueAt, today)),
    )
    // Ulangan jatuh tempo dulu, lalu kata baru: level dasar dan kata paling sering dipakai lebih dulu.
    .orderBy(
      sql`case when ${vocabularyProgress.id} is null then 1 else 0 end`,
      sql`case ${vocabulary.level} when 'basic' then 0 when 'intermediate' then 1 else 2 end`,
      sql`coalesce(${vocabulary.frequencyRank}, 999999)`,
      asc(vocabulary.id),
    )
    .limit(limit * 3);

  const cards = rows.map(({ word, progress }) => ({
    ...word,
    box: progress?.box ?? 0,
    dueAt: progress?.dueAt ?? null,
    reviewCount: progress?.reviewCount ?? 0,
    correctCount: progress?.correctCount ?? 0,
    lastReviewedAt: progress?.lastReviewedAt ?? null,
  }));

  return cards.sort((a, b) => {
    if (a.box !== b.box) return a.box - b.box;
    return (a.dueAt ?? "").localeCompare(b.dueAt ?? "");
  }).slice(0, limit);
}

export async function reviewCard(
  userId: number,
  vocabularyId: number,
  correct: boolean,
  grade?: ReviewGrade,
) {
  const progress = await ensureProgress(userId, vocabularyId);
  const today = todayISO();
  const next = nextReviewFsrs({
    box: progress.box,
    easeFactor: progress.easeFactor,
    intervalDays: progress.intervalDays,
    lapses: progress.lapses,
    correct,
    today,
    grade,
  });

  await db
    .update(vocabularyProgress)
    .set({
      box: next.box,
      dueAt: next.dueAt,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      lapses: next.lapses,
      reviewCount: progress.reviewCount + 1,
      correctCount: progress.correctCount + (correct ? 1 : 0),
      lastReviewedAt: today,
    })
    .where(eq(vocabularyProgress.id, progress.id));

  return next;
}

/** Pure helper untuk pengujian logika FSRS dari baris progress. */
export function reviewCardNext(state: {
  box: number;
  easeFactor: number;
  intervalDays: number;
  lapses: number;
  correct: boolean;
}) {
  return nextReviewFsrs({ ...state, today: todayISO() });
}

/** Jumlah kata yang naik ke box >= 5 dalam 7 hari terakhir (north star proxy). */
export async function masteredThisWeek(userId: number) {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString().slice(0, 10);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(vocabularyProgress)
    .where(
      and(
        eq(vocabularyProgress.userId, userId),
        sql`${vocabularyProgress.box} >= 5`,
        gte(vocabularyProgress.lastReviewedAt, sinceIso),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function vocabularyStats(userId: number) {
  const [total] = await db.select({ n: sql<number>`count(*)` }).from(vocabulary);
  const [tracked] = await db
    .select({ n: sql<number>`count(*)` })
    .from(vocabularyProgress)
    .where(eq(vocabularyProgress.userId, userId));
  const [due] = await db
    .select({ n: sql<number>`count(*)` })
    .from(vocabularyProgress)
    .where(and(eq(vocabularyProgress.userId, userId), lte(vocabularyProgress.dueAt, todayISO())));
  const [mastered] = await db
    .select({ n: sql<number>`count(*)` })
    .from(vocabularyProgress)
    .where(and(eq(vocabularyProgress.userId, userId), sql`${vocabularyProgress.box} >= 5`));

  return {
    total: Number(total?.n ?? 0),
    tracked: Number(tracked?.n ?? 0),
    due: Number(due?.n ?? 0),
    mastered: Number(mastered?.n ?? 0),
  };
}

/** Jumlah kartu jatuh tempo per hari untuk `days` hari ke depan; yang terlambat masuk hari ini. */
export async function dueForecast(userId: number, today: string, days = 7) {
  const end = shiftDate(today, days - 1);
  const rows = await db
    .select({ dueAt: vocabularyProgress.dueAt, n: sql<number>`count(*)` })
    .from(vocabularyProgress)
    .where(and(eq(vocabularyProgress.userId, userId), lte(vocabularyProgress.dueAt, end)))
    .groupBy(vocabularyProgress.dueAt);

  const counts = Array.from({ length: days }, (_, index) => ({ date: shiftDate(today, index), count: 0 }));
  for (const row of rows) {
    const index = row.dueAt <= today ? 0 : counts.findIndex((day) => day.date === row.dueAt);
    if (index >= 0) counts[index].count += Number(row.n);
  }
  return counts;
}
