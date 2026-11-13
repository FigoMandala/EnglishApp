import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  grammarAttempts,
  grammarExercises,
  grammarLessonProgress,
  grammarLessons,
  type GrammarLesson,
  type NewGrammarLesson,
} from "@/db/schema";

export type GrammarLessonWithProgress = GrammarLesson & {
  completed: boolean;
  completedAt: string | null;
};

export async function listGrammarLessons(userId: number): Promise<GrammarLessonWithProgress[]> {
  // Hanya materi terbit yang tampil ke pelajar — sama seperti daftar unit
  // (listUnitsWithItems); kolom published adalah "sembunyikan dari pelajar".
  const rows = await db
    .select({ lesson: grammarLessons, progress: grammarLessonProgress })
    .from(grammarLessons)
    .leftJoin(
      grammarLessonProgress,
      and(
        eq(grammarLessonProgress.lessonId, grammarLessons.id),
        eq(grammarLessonProgress.userId, userId),
      ),
    )
    .where(eq(grammarLessons.published, true))
    .orderBy(asc(grammarLessons.orderIndex), asc(grammarLessons.id));

  return rows.map(({ lesson, progress }) => ({
    ...lesson,
    completed: Boolean(progress?.completedAt),
    completedAt: progress?.completedAt ?? null,
  }));
}

export async function getGrammarLesson(slug: string, userId: number) {
  // Materi yang disembunyikan diperlakukan tidak ada: URL langsung ke draft
  // tidak boleh membukanya (gate published, sama seperti lessonReadyToComplete).
  const [row] = await db
    .select({ lesson: grammarLessons, progress: grammarLessonProgress })
    .from(grammarLessons)
    .leftJoin(
      grammarLessonProgress,
      and(
        eq(grammarLessonProgress.lessonId, grammarLessons.id),
        eq(grammarLessonProgress.userId, userId),
      ),
    )
    .where(and(eq(grammarLessons.slug, slug), eq(grammarLessons.published, true)))
    .limit(1);
  if (!row) return null;
  return {
    ...row.lesson,
    completed: Boolean(row.progress?.completedAt),
    completedAt: row.progress?.completedAt ?? null,
  };
}

export async function getGrammarLessonById(id: number) {
  const [row] = await db.select().from(grammarLessons).where(eq(grammarLessons.id, id)).limit(1);
  return row ?? null;
}

export async function createGrammarLesson(values: NewGrammarLesson) {
  const [row] = await db.insert(grammarLessons).values(values).returning();
  return row;
}

export async function updateGrammarLesson(id: number, values: Partial<NewGrammarLesson>) {
  await db.update(grammarLessons).set(values).where(eq(grammarLessons.id, id));
}

export async function deleteGrammarLesson(id: number) {
  await db.delete(grammarLessons).where(eq(grammarLessons.id, id));
}

/** Simpan status selesai. Mengembalikan true kalau ini penyelesaian pertama (belum pernah ada baris). */
export async function setLessonCompleted(userId: number, lessonId: number, completed: boolean) {
  const [existing] = await db
    .select()
    .from(grammarLessonProgress)
    .where(
      and(eq(grammarLessonProgress.userId, userId), eq(grammarLessonProgress.lessonId, lessonId)),
    )
    .limit(1);

  const completedAt = completed ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;

  if (existing) {
    await db
      .update(grammarLessonProgress)
      .set({ completedAt })
      .where(eq(grammarLessonProgress.id, existing.id));
    return false;
  }

  // Dua klik paralel bisa sama-sama lolos cek di atas; yang kalah tidak
  // meledak UNIQUE constraint berkat onConflictDoNothing.
  const [inserted] = await db
    .insert(grammarLessonProgress)
    .values({ userId, lessonId, completedAt })
    .onConflictDoNothing()
    .returning({ id: grammarLessonProgress.id });
  return inserted ? completed : false;
}

export async function grammarStats(userId: number) {
  const [total] = await db
    .select({ n: sql<number>`count(*)` })
    .from(grammarLessons)
    .where(eq(grammarLessons.published, true));
  const [done] = await db
    .select({ n: sql<number>`count(*)` })
    .from(grammarLessonProgress)
    .where(
      and(
        eq(grammarLessonProgress.userId, userId),
        sql`${grammarLessonProgress.completedAt} is not null`,
      ),
    );
  return { total: Number(total?.n ?? 0), completed: Number(done?.n ?? 0) };
}

/**
 * Syarat XP "lesson selesai": materi ada dan terbit, plus pengguna punya
 * minimal satu jawaban benar pada latihannya (bukti kerja server-side —
 * melawan pemanggilan markLessonDoneAction langsung tanpa mengerjakan soal).
 * Materi tanpa latihan dianggap boleh diselesaikan setelah dibaca.
 */
export async function lessonReadyToComplete(userId: number, lessonId: number) {
  const lesson = await getGrammarLessonById(lessonId);
  if (!lesson || !lesson.published) return false;
  const [totalExercises] = await db
    .select({ n: sql<number>`count(*)` })
    .from(grammarExercises)
    .where(eq(grammarExercises.lessonId, lessonId));
  if (Number(totalExercises?.n ?? 0) === 0) return true;
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(grammarAttempts)
    .innerJoin(grammarExercises, eq(grammarExercises.id, grammarAttempts.exerciseId))
    .where(
      and(
        eq(grammarAttempts.userId, userId),
        eq(grammarExercises.lessonId, lessonId),
        eq(grammarAttempts.correct, true),
      ),
    );
  return Number(row?.n ?? 0) > 0;
}
