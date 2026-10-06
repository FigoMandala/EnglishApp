import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  grammarAttempts,
  grammarExercises,
  grammarLessons,
  type NewGrammarExercise,
} from "@/db/schema";

export type ExerciseWithAttempt = Awaited<ReturnType<typeof listLessonExercises>>[number];

export async function listLessonExercises(lessonId: number, userId: number) {
  const rows = await db
    .select({ exercise: grammarExercises, attempt: grammarAttempts })
    .from(grammarExercises)
    .leftJoin(
      grammarAttempts,
      and(
        eq(grammarAttempts.exerciseId, grammarExercises.id),
        eq(grammarAttempts.userId, userId),
      ),
    )
    .where(eq(grammarExercises.lessonId, lessonId))
    .orderBy(asc(grammarExercises.orderIndex), asc(grammarExercises.id));

  return rows.map(({ exercise, attempt }) => ({
    ...exercise,
    answered: attempt
      ? { answer: attempt.answer, correct: Boolean(attempt.correct) }
      : null,
  }));
}

export async function getExerciseById(id: number) {
  const [row] = await db
    .select()
    .from(grammarExercises)
    .where(eq(grammarExercises.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Simpan jawaban. Mengembalikan `firstCorrect: true` hanya saat soal pertama
 * kali dijawab benar, supaya XP tidak bisa dipanen berulang.
 */
export async function recordAttempt(
  userId: number,
  exerciseId: number,
  answer: string,
  correct: boolean,
) {
  const [existing] = await db
    .select({ id: grammarAttempts.id, correct: grammarAttempts.correct })
    .from(grammarAttempts)
    .where(
      and(eq(grammarAttempts.userId, userId), eq(grammarAttempts.exerciseId, exerciseId)),
    )
    .limit(1);

  if (existing) {
    await db
      .update(grammarAttempts)
      .set({ answer, correct })
      .where(eq(grammarAttempts.id, existing.id));
    return { firstCorrect: correct && !existing.correct };
  }

  await db.insert(grammarAttempts).values({ userId, exerciseId, answer, correct });
  return { firstCorrect: correct };
}

export async function resetAttempts(userId: number, lessonId: number) {
  const ids = await db
    .select({ id: grammarExercises.id })
    .from(grammarExercises)
    .where(eq(grammarExercises.lessonId, lessonId));
  if (ids.length === 0) return;
  for (const { id } of ids) {
    await db
      .delete(grammarAttempts)
      .where(and(eq(grammarAttempts.userId, userId), eq(grammarAttempts.exerciseId, id)));
  }
}

/** Jumlah soal & jawaban benar per lesson untuk halaman daftar. */
export async function exerciseStatsByLesson(userId: number) {
  const rows = await db
    .select({
      lessonSlug: grammarLessons.slug,
      total: sql<number>`count(${grammarExercises.id})`,
      correct: sql<number>`sum(case when ${grammarAttempts.correct} = 1 then 1 else 0 end)`,
      answered: sql<number>`count(${grammarAttempts.id})`,
    })
    .from(grammarExercises)
    .innerJoin(grammarLessons, eq(grammarLessons.id, grammarExercises.lessonId))
    .leftJoin(
      grammarAttempts,
      and(
        eq(grammarAttempts.exerciseId, grammarExercises.id),
        eq(grammarAttempts.userId, userId),
      ),
    )
    .groupBy(grammarLessons.slug);

  return new Map(
    rows.map((row) => [
      row.lessonSlug,
      {
        total: Number(row.total ?? 0),
        answered: Number(row.answered ?? 0),
        correct: Number(row.correct ?? 0),
      },
    ]),
  );
}

export async function createExercise(values: NewGrammarExercise) {
  const [row] = await db.insert(grammarExercises).values(values).returning();
  return row;
}

export async function countExercises() {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(grammarExercises);
  return Number(row?.n ?? 0);
}