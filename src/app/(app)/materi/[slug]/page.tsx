import { ArrowLeft, CheckCircle2, Dumbbell } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LessonBody } from "@/components/lesson-body";
import { listLessonExercises } from "@/db/queries/grammar-exercises";
import { getGrammarLesson } from "@/db/queries/grammar";
import { requireUser } from "@/lib/session";

import { ExerciseRunner } from "./exercise-runner";

export const metadata = { title: "Materi · EnglishApp" };

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();

  const lesson = await getGrammarLesson(slug, user.id);
  if (!lesson) notFound();

  const exercises = await listLessonExercises(lesson.id, user.id);
  const answeredCount = exercises.filter((exercise) => exercise.answered).length;
  const correctCount = exercises.filter((exercise) => exercise.answered?.correct).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/materi"
          className="flex items-center gap-1.5 text-[0.875rem] font-bold text-ink-subtle transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Materi Grammar
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[2rem] font-extrabold leading-tight tracking-[-0.02em]">
              {lesson.title}
            </h1>
            <p className="text-[0.9375rem] text-ink-subtle">{lesson.summary}</p>
          </div>
          {lesson.completed ? (
            <span className="flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-[0.875rem] font-bold text-primary-deep">
              <CheckCircle2 className="size-4" aria-hidden />
              Materi selesai
            </span>
          ) : null}
        </div>
      </div>

      <section aria-label="Materi" className="clay p-6 sm:p-8">
        <LessonBody body={lesson.body} />
      </section>

      <section aria-labelledby="latihan-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="latihan-title" className="flex items-center gap-2.5 font-display text-[1.5rem] font-extrabold">
              <Dumbbell className="size-5 text-primary" aria-hidden />
              Latihan
            </h2>
            <p className="text-[0.9375rem] text-ink-subtle">
              {exercises.length} soal · {correctCount} benar dari {answeredCount} yang sudah dijawab.
              Selesaikan semua untuk menandai materi ini selesai.
            </p>
          </div>
        </div>

        {exercises.length === 0 ? (
          <p className="text-[0.9375rem] text-ink-subtle">Latihan untuk materi ini belum tersedia.</p>
        ) : (
          <ExerciseRunner
            lessonId={lesson.id}
            exercises={exercises.map((exercise) => ({
              id: exercise.id,
              type: exercise.type,
              prompt: exercise.prompt,
              hint: exercise.hint,
              options: exercise.options,
              answered: exercise.answered,
            }))}
          />
        )}
      </section>
    </div>
  );
}
