import type { NewGrammarExercise, NewGrammarLesson } from "./schema";

/** Satu soal dalam seed: lessonId diisi saat seeding, bukan di data. */
export type ExerciseSeed = Omit<NewGrammarExercise, "lessonId">;

/** Satu pelajaran beserta soalnya. Kalau slug sudah ada, hanya soalnya yang ditambah. */
export type LessonSeed = { lesson: NewGrammarLesson; exercises: ExerciseSeed[] };
