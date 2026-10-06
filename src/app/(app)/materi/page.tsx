import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { exerciseStatsByLesson } from "@/db/queries/grammar-exercises";
import { listGrammarLessons } from "@/db/queries/grammar";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Materi Grammar · EnglishApp" };

const LEVEL_LABEL = { basic: "Dasar", intermediate: "Menengah", advanced: "Lanjut" } as const;

export default async function MateriPage() {
  const user = await requireUser();
  const [lessons, stats] = await Promise.all([
    listGrammarLessons(user.id),
    exerciseStatsByLesson(user.id),
  ]);

  const done = lessons.filter((lesson) => lesson.completed).length;
  const grouped = {
    basic: lessons.filter((lesson) => lesson.level === "basic"),
    intermediate: lessons.filter((lesson) => lesson.level === "intermediate"),
    advanced: lessons.filter((lesson) => lesson.level === "advanced"),
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <p className="eyebrow text-ink-subtle">Materi Grammar</p>
        <h1 className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[2.5rem]">
          Pahami aturannya, latih soalnya
        </h1>
        <p className="max-w-2xl text-[0.9375rem] text-ink-subtle">
          {done} dari {lessons.length} materi selesai. Tiap materi punya ringkasan aturan dan latihan
          yang dinilai otomatis: isian, pilihan ganda, susun kata, terjemah, dan tulis kalimat.
        </p>
      </header>

      {lessons.length === 0 ? (
        <Card className="p-6">
          <p className="text-[0.9375rem] text-ink-subtle">
            Materi belum diisi. Jalankan <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">npm run db:seed</code>.
          </p>
        </Card>
      ) : (
        (["basic", "intermediate", "advanced"] as const)
          .filter((level) => grouped[level].length > 0)
          .map((level) => (
            <section key={level} aria-labelledby={`level-${level}`} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h2 id={`level-${level}`} className="font-display text-[1.375rem] font-extrabold">
                  {LEVEL_LABEL[level]}
                </h2>
                <span className="h-px flex-1 bg-hairline" aria-hidden />
                <span className="text-[0.8125rem] font-semibold text-ink-faint">
                  {grouped[level].filter((lesson) => lesson.completed).length}/{grouped[level].length} selesai
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[level].map((lesson) => {
                  const stat = stats.get(lesson.slug);
                  return (
                    <Link
                      key={lesson.id}
                      href={`/materi/${lesson.slug}`}
                      className={cn(
                        "clay clay-hover flex flex-col gap-2 p-5",
                        lesson.completed && "border-primary/40",
                      )}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <BookOpen className="size-5 shrink-0 text-primary" aria-hidden />
                        {lesson.completed ? (
                          <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
                        ) : null}
                      </span>
                      <span className="font-display text-[1.0625rem] font-extrabold leading-snug text-ink">
                        {lesson.title}
                      </span>
                      <span className="line-clamp-2 text-[0.875rem] leading-snug text-ink-subtle">
                        {lesson.summary}
                      </span>
                      <span className="mt-auto flex items-center justify-between pt-2 text-[0.8125rem] font-semibold">
                        <span className="text-ink-faint">
                          {stat && stat.total > 0
                            ? `${stat.correct}/${stat.total} latihan benar`
                            : "belum ada latihan"}
                        </span>
                        <span className="flex items-center gap-1 text-primary">
                          Buka
                          <ArrowRight className="size-3.5" aria-hidden />
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
