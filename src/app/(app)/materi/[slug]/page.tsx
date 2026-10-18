import { notFound } from "next/navigation";

import { listLessonExercises } from "@/db/queries/grammar-exercises";
import { getGrammarLesson, listGrammarLessons } from "@/db/queries/grammar";
import { requireUser } from "@/lib/session";

import { ExerciseRunner } from "./exercise-runner";
import { LessonStepper, type LessonSection } from "./lesson-stepper";

export const metadata = { title: "Materi · EnglishApp" };

const LEVEL_LABEL = { basic: "Dasar", intermediate: "Menengah", advanced: "Lanjut" } as const;

/** Pecah isi materi per `## judul`. Bagian "Latihan" (berisi kunci jawaban) dibuang: soal asli ada di runner. */
function splitSections(body: string): LessonSection[] {
  const parts = body.replace(/\r\n?/g, "\n").split(/^##\s+/m);
  const sections: LessonSection[] = [];
  const intro = parts.shift()?.trim();
  if (intro) sections.push({ title: "Pengantar", body: intro });
  for (const part of parts) {
    const [title, ...rest] = part.split("\n");
    if (/^latihan\b/i.test(title.trim())) continue;
    sections.push({ title: title.trim(), body: rest.join("\n").trim() });
  }
  return sections.length > 0 ? sections : [{ title: "Materi", body }];
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();

  const lesson = await getGrammarLesson(slug, user.id);
  if (!lesson) notFound();

  const [exercises, lessons] = await Promise.all([
    listLessonExercises(lesson.id, user.id),
    listGrammarLessons(user.id),
  ]);
  const answered = exercises.filter((exercise) => exercise.answered);
  const correct = answered.filter((exercise) => exercise.answered?.correct).length;

  return (
    <LessonStepper
      eyebrow={`MATERI · GRAMMAR · ${LEVEL_LABEL[lesson.level].toUpperCase()}`}
      title={lesson.title}
      summary={lesson.summary}
      sections={splitSections(lesson.body)}
      exerciseCount={exercises.length}
      practice={
        exercises.length === 0 ? null : (
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
        )
      }
      toc={lessons
        .filter((item) => item.level === lesson.level)
        .map((item) => ({ slug: item.slug, title: item.title, completed: item.completed }))}
      tocTitle={`Materi ${LEVEL_LABEL[lesson.level]}`}
      currentSlug={lesson.slug}
      mastery={{ correct, total: exercises.length }}
    />
  );
}
