import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  vocabulary,
  vocabularyProgress,
  type NewVocabulary,
  type Vocabulary,
} from "@/db/schema";
import { nextReviewFsrs, shiftDate, todayISO, type ReviewGrade } from "@/lib/srs";

/** Escape wildcard LIKE (\, %, _) dari input pengguna; pasangkan dengan `escape '\'` di SQL. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

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

export type VocabularyPageFilter = {
  level?: Vocabulary["level"];
  topic?: string;
  q?: string;
  status?: "new" | "due" | "mastered";
  today: string;
  limit: number;
};

/** Baris ringan tabel kosakata: cukup untuk tabel halaman Kosakata. */
export type VocabularyRow = {
  id: number;
  word: string;
  meaning: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  exampleEn: string | null;
  level: Vocabulary["level"];
  cefr: Vocabulary["cefr"];
  topic: string | null;
  box: number;
  dueAt: string | null;
  lastReviewedAt: string | null;
};

export type VocabularyPage = {
  rows: VocabularyRow[];
  matchedCount: number;
  newWaiting: number;
  topics: string[];
};

/**
 * Halaman Kosakata versi hemat: filter (level/topik/cari/status) didorong ke
 * SQL, hanya kolom ringan yang diambil, dan batas baris diterapkan di query.
 * Dulu halaman ini memuat semua baris kosakata + join progress per request.
 */
export async function listVocabularyPage(userId: number, filter: VocabularyPageFilter): Promise<VocabularyPage> {
  const p = vocabularyProgress;
  // Wildcard LIKE dari input pengguna di-escape: % dan _ bebas membuat query
  // memindai seluruh tabel (audit keamanan P3). Nilainya tetap parameter terikat.
  const q = filter.q ? escapeLike(filter.q.toLowerCase()) : "";
  const conditions = [
    filter.level ? eq(vocabulary.level, filter.level) : undefined,
    filter.topic ? sql`lower(${vocabulary.topic}) = ${filter.topic.toLowerCase()}` : undefined,
    filter.q
      ? sql`(lower(${vocabulary.word}) like ${`%${q}%`} escape '\\' or lower(${vocabulary.meaning}) like ${`%${q}%`} escape '\\')`
      : undefined,
  ];
  if (filter.status === "new") {
    // Belum pernah diulang: belum punya baris progress, atau belum pernah review.
    conditions.push(sql`(${p.id} is null or ${p.lastReviewedAt} is null)`);
  } else if (filter.status === "due") {
    conditions.push(sql`${p.lastReviewedAt} is not null and ${p.dueAt} is not null and ${p.dueAt} <= ${filter.today}`);
  } else if (filter.status === "mastered") {
    // Dikuasai = box >= 5 dan tidak sedang jatuh tempo (urutan cek wordStatus).
    conditions.push(
      sql`${p.lastReviewedAt} is not null and (${p.dueAt} is null or ${p.dueAt} > ${filter.today}) and ${p.box} >= 5`,
    );
  }
  const where = and(...conditions);

  const [rows, matched, waiting, topicRows] = await Promise.all([
    db
      .select({
        id: vocabulary.id,
        word: vocabulary.word,
        meaning: vocabulary.meaning,
        phonetic: vocabulary.phonetic,
        partOfSpeech: vocabulary.partOfSpeech,
        exampleEn: vocabulary.exampleEn,
        level: vocabulary.level,
        cefr: vocabulary.cefr,
        topic: vocabulary.topic,
        box: p.box,
        dueAt: p.dueAt,
        lastReviewedAt: p.lastReviewedAt,
      })
      .from(vocabulary)
      .leftJoin(p, and(eq(p.vocabularyId, vocabulary.id), eq(p.userId, userId)))
      .where(where)
      .orderBy(asc(vocabulary.word), asc(vocabulary.id))
      .limit(filter.limit),
    db.select({ n: sql<number>`count(*)` }).from(vocabulary)
      .leftJoin(p, and(eq(p.vocabularyId, vocabulary.id), eq(p.userId, userId)))
      .where(where),
    // "Kata baru menunggu" selalu dihitung dari seluruh dek, tanpa filter halaman.
    db.select({ n: sql<number>`count(*)` }).from(vocabulary)
      .leftJoin(p, and(eq(p.vocabularyId, vocabulary.id), eq(p.userId, userId)))
      .where(sql`${p.id} is null or ${p.lastReviewedAt} is null`),
    db.select({ topic: vocabulary.topic }).from(vocabulary)
      .where(isNotNull(vocabulary.topic))
      .groupBy(vocabulary.topic)
      .orderBy(asc(vocabulary.topic)),
  ]);

  return {
    rows: rows.map((row) => ({
      ...row,
      box: row.box ?? 0,
      dueAt: row.dueAt ?? null,
      lastReviewedAt: row.lastReviewedAt ?? null,
    })),
    matchedCount: Number(matched[0]?.n ?? 0),
    newWaiting: Number(waiting[0]?.n ?? 0),
    topics: topicRows.map((row) => row.topic).filter((topic): topic is string => Boolean(topic)),
  };
}

/** Kolom ringan untuk pemilihan kata unit (tanpa arti/contoh yang berat). */
export type UnitWordPoolRow = {
  id: number;
  word: string;
  level: Vocabulary["level"];
  topic: string | null;
  frequencyRank: number | null;
};

export async function listUnitWordPool(userId: number): Promise<UnitWordPoolRow[]> {
  return db
    .select({
      id: vocabulary.id,
      word: vocabulary.word,
      level: vocabulary.level,
      topic: vocabulary.topic,
      frequencyRank: vocabulary.frequencyRank,
    })
    .from(vocabulary)
    .leftJoin(vocabularyProgress, and(
      eq(vocabularyProgress.vocabularyId, vocabulary.id),
      eq(vocabularyProgress.userId, userId),
    ))
    .orderBy(asc(vocabulary.word), asc(vocabulary.id));
}

/** Detail lengkap + progress untuk kumpulan id tertentu (urutan mengikuti input). */
export async function vocabularyDetails(userId: number, ids: number[]): Promise<VocabularyCard[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const rows = await db
    .select({ word: vocabulary, progress: vocabularyProgress })
    .from(vocabulary)
    .leftJoin(
      vocabularyProgress,
      and(eq(vocabularyProgress.vocabularyId, vocabulary.id), eq(vocabularyProgress.userId, userId)),
    )
    .where(inArray(vocabulary.id, unique));
  const byId = new Map(rows.map(({ word, progress }) => [word.id, {
    ...word,
    box: progress?.box ?? 0,
    dueAt: progress?.dueAt ?? null,
    reviewCount: progress?.reviewCount ?? 0,
    correctCount: progress?.correctCount ?? 0,
    lastReviewedAt: progress?.lastReviewedAt ?? null,
  }]));
  return ids.map((id) => byId.get(id)).filter((card): card is VocabularyCard => Boolean(card));
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

  // Dua review paralel bisa sama-sama lolos cek di atas; onConflictDoNothing
  // membuat yang kalah tidak meledak UNIQUE constraint, lalu dibaca ulang.
  const [inserted] = await db
    .insert(vocabularyProgress)
    .values({ userId, vocabularyId, dueAt: todayISO(), box: 0 })
    .onConflictDoNothing()
    .returning();
  if (inserted) return inserted;

  const [row] = await db
    .select()
    .from(vocabularyProgress)
    .where(
      and(
        eq(vocabularyProgress.userId, userId),
        eq(vocabularyProgress.vocabularyId, vocabularyId),
      ),
    )
    .limit(1);
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
  const today = todayISO();

  // reviewCount dipakai sebagai versi baris: update jadwal FSRS hanya lolos
  // kalau reviewCount masih sama seperti saat dibaca. Dua review paralel
  // tidak lagi saling menimpa jadwal (yang kalah baca ulang lalu menghitung
  // dari state terbaru). Setelah 3 percobaan, tulis tanpa guard agar review
  // tidak pernah hilang.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const progress = await ensureProgress(userId, vocabularyId);
    const next = nextReviewFsrs({
      box: progress.box,
      easeFactor: progress.easeFactor,
      intervalDays: progress.intervalDays,
      lapses: progress.lapses,
      correct,
      today,
      grade,
    });

    // reviewCount/correctCount dinaikkan SQL-side supaya dua review paralel
    // tidak saling menimpa (lost update). reviewCount hasil tulis juga jadi
    // penanda review pertama: 1 berarti kartu baru mulai dipelajari.
    const [updated] = await db
      .update(vocabularyProgress)
      .set({
        box: next.box,
        dueAt: next.dueAt,
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        lapses: next.lapses,
        reviewCount: sql`${vocabularyProgress.reviewCount} + 1`,
        correctCount: sql`${vocabularyProgress.correctCount} + ${correct ? 1 : 0}`,
        lastReviewedAt: today,
      })
      .where(
        and(
          eq(vocabularyProgress.id, progress.id),
          eq(vocabularyProgress.reviewCount, progress.reviewCount),
        ),
      )
      .returning({ reviewCount: vocabularyProgress.reviewCount });

    if (updated) return { ...next, firstReview: updated.reviewCount === 1 };
  }

  // Fallback terakhir: state terbaru tidak kunjung stabil (race ekstrem);
  // tulis apa adanya berdasarkan baris terkini.
  const progress = await ensureProgress(userId, vocabularyId);
  const next = nextReviewFsrs({
    box: progress.box,
    easeFactor: progress.easeFactor,
    intervalDays: progress.intervalDays,
    lapses: progress.lapses,
    correct,
    today,
    grade,
  });
  const [updated] = await db
    .update(vocabularyProgress)
    .set({
      box: next.box,
      dueAt: next.dueAt,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      lapses: next.lapses,
      reviewCount: sql`${vocabularyProgress.reviewCount} + 1`,
      correctCount: sql`${vocabularyProgress.correctCount} + ${correct ? 1 : 0}`,
      lastReviewedAt: today,
    })
    .where(eq(vocabularyProgress.id, progress.id))
    .returning({ reviewCount: vocabularyProgress.reviewCount });

  return { ...next, firstReview: (updated?.reviewCount ?? 0) === 1 };
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
  // Tanggal di DB ditulis dengan todayISO() (Asia/Jakarta); window juga
  // dihitung dari sana, bukan dari jam UTC server.
  const sinceIso = shiftDate(todayISO(), -7);
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
