import { and, asc, eq, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  grammarAttempts,
  grammarExercises,
  grammarLessons,
  type GrammarExerciseType,
  type NewGrammarExercise,
} from "@/db/schema";

export type ExerciseWithAttempt = Awaited<ReturnType<typeof listLessonExercises>>[number];

export async function listLessonExercises(lessonId: number, userId: number) {
  const rows = await db
    .select({ exercise: grammarExercises, attempt: grammarAttempts })
    .from(grammarExercises)
    .innerJoin(grammarLessons, eq(grammarLessons.id, grammarExercises.lessonId))
    .leftJoin(
      grammarAttempts,
      and(
        eq(grammarAttempts.exerciseId, grammarExercises.id),
        eq(grammarAttempts.userId, userId),
      ),
    )
    // Hanya soal dari materi terbit — soal draft tidak boleh bocor walau
    // pemanggil lupa mem-gate lesson-nya (gate published, sama seperti
    // listGrammarLessons/getGrammarLesson).
    .where(and(eq(grammarExercises.lessonId, lessonId), eq(grammarLessons.published, true)))
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
 * Double-submit yang balapan ditangkap via indeks unik (update, bukan error).
 */
export async function recordAttempt(
  userId: number,
  exerciseId: number,
  answer: string,
  correct: boolean,
) {
  const find = async () => {
    const [row] = await db
      .select({ id: grammarAttempts.id, correct: grammarAttempts.correct })
      .from(grammarAttempts)
      .where(
        and(eq(grammarAttempts.userId, userId), eq(grammarAttempts.exerciseId, exerciseId)),
      )
      .limit(1);
    return row ?? null;
  };
  const stamp = () =>
    new Date().toISOString().slice(0, 19).replace("T", " ");
  const save = async (id: number, prevCorrect: boolean) => {
    await db
      .update(grammarAttempts)
      .set({ answer, correct, ...(correct ? { lastCorrectAt: stamp() } : {}) })
      .where(eq(grammarAttempts.id, id));
    return { firstCorrect: correct && !prevCorrect };
  };

  const existing = await find();
  if (existing) return save(existing.id, existing.correct);

  try {
    await db
      .insert(grammarAttempts)
      .values({ userId, exerciseId, answer, correct, lastCorrectAt: correct ? stamp() : null });
    return { firstCorrect: correct };
  } catch (error) {
    // Request lain membuat barisnya duluan: jatuh ke update.
    if (!(error instanceof Error) || !/unique|constraint/i.test(error.message)) throw error;
    const raced = await find();
    if (!raced) throw error;
    return save(raced.id, raced.correct);
  }
}

export async function resetAttempts(userId: number, lessonId: number) {
  const ids = await db
    .select({ id: grammarExercises.id })
    .from(grammarExercises)
    .where(eq(grammarExercises.lessonId, lessonId));
  if (ids.length === 0) return;
  // Satu transaksi: kalau gagal di tengah, jangan menyisakan reset parsial.
  // Catatan: baris grammar_attempts menyimpan lastCorrectAt — bukti kerja XP
  // lesson (lessonReadyToComplete). Setelah reset, soal bisa dijawab "pertama
  // kali benar" lagi sehingga XP dapat dipanen ulang; pemanggil harus sadar
  // efek itu. (Saat ini belum ada pemanggil fungsi ini di aplikasi.)
  await db.transaction(async (tx) => {
    for (const { id } of ids) {
      await tx
        .delete(grammarAttempts)
        .where(and(eq(grammarAttempts.userId, userId), eq(grammarAttempts.exerciseId, id)));
    }
  });
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

export type PracticeLevel = "basic" | "intermediate" | "advanced";

export type PracticeExercise = {
  id: number;
  lessonSlug: string;
  lessonTitle: string;
  level: PracticeLevel;
  type: GrammarExerciseType;
  prompt: string;
  hint: string | null;
  options: string | null;
  answered: { answer: string; correct: boolean } | null;
};

/**
 * Ambil soal acak lintas materi untuk mode latihan bebas. Soal "compose"
 * dikecualikan karena penilaiannya memanggil AI (biaya & latensi), sedangkan
 * tipe lain dinilai lokal dan instan.
 */
export async function pickPracticeExercises(
  userId: number,
  options: { level?: PracticeLevel; limit?: number; choiceOnly?: boolean } = {},
): Promise<PracticeExercise[]> {
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 40);

  const rows = await db
    .select({ exercise: grammarExercises, attempt: grammarAttempts, lesson: grammarLessons })
    .from(grammarExercises)
    .innerJoin(grammarLessons, eq(grammarLessons.id, grammarExercises.lessonId))
    .leftJoin(
      grammarAttempts,
      and(
        eq(grammarAttempts.exerciseId, grammarExercises.id),
        eq(grammarAttempts.userId, userId),
      ),
    )
    .where(
      and(
        options.choiceOnly
          ? eq(grammarExercises.type, "choice")
          : notInArray(grammarExercises.type, ["compose"]),
        options.level ? eq(grammarLessons.level, options.level) : undefined,
        // Latihan bebas hanya mengambil soal materi terbit — tanpa ini soal
        // draft ikut tampil di sini karena halaman pemanggil tidak mem-gate
        // lesson-nya (gate published, sama seperti listGrammarLessons).
        eq(grammarLessons.published, true),
      ),
    )
    .orderBy(sql`random()`)
    .limit(limit);

  return rows.map(({ exercise, attempt, lesson }) => ({
    id: exercise.id,
    lessonSlug: lesson.slug,
    lessonTitle: lesson.title,
    level: lesson.level,
    type: exercise.type,
    prompt: exercise.prompt,
    hint: exercise.hint,
    options: exercise.options,
    answered: attempt
      ? { answer: attempt.answer, correct: Boolean(attempt.correct) }
      : null,
  }));
}