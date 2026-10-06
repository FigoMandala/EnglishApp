import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, Lock, SpellCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getUnitBySlug, isUnitCompleted, listUnitsWithItems, completedUnitIds } from "@/db/queries/learning";
import { requireUser } from "@/lib/session";
import { listVocabularyCards } from "@/db/queries/vocabulary";
import { listGrammarLessons } from "@/db/queries/grammar";
import { pickUnitWords } from "@/lib/unit-words";
import { cn } from "@/lib/utils";

import { CompleteUnitButton } from "./complete-button";

export const metadata = { title: "Unit · Jalur Belajar" };

export default async function UnitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();

  const unit = await getUnitBySlug(slug);
  if (!unit) notFound();

  const [units, completedLessons, unitDone, completed] = await Promise.all([
    listUnitsWithItems(),
    listGrammarLessons(user.id),
    isUnitCompleted(user.id, unit.id),
    completedUnitIds(user.id),
  ]);

  // Unit terkunci kalau unit sebelumnya belum selesai.
  const order = units.findIndex((u) => u.id === unit.id);
  const previous = order > 0 ? units[order - 1] : null;
  const locked = previous ? !completed.has(previous.id) : false;

  if (locked) {
    // Kembali lebih awal: tidak perlu memuat kosakata dan materi.
    return (
      <div className="flex flex-col items-start gap-4">
        <BackLink />
        <Card className="flex w-full flex-col items-center gap-3 p-10 text-center">
          <Lock className="size-10 text-ink-faint" aria-hidden />
          <h1 className="font-display text-[1.5rem] font-extrabold">Unit masih terkunci</h1>
          <p className="max-w-md text-[0.9375rem] text-ink-subtle">
            Selesaikan <strong>{previous?.title}</strong> dulu untuk membuka unit ini.
          </p>
          <Link href="/belajar" className="text-[0.9375rem] font-bold text-primary hover:underline">
            Kembali ke peta jalur
          </Link>
        </Card>
      </div>
    );
  }

  const lessonDone = new Set(
    completedLessons.filter((lesson) => lesson.completed).map((lesson) => lesson.id),
  );

  // Kata untuk langkah kosakata: dicocokkan dari judul item.
  const allWords = await listVocabularyCards(user.id);
  const vocabSteps = unit.items.map((item) => {
    if (item.kind !== "vocab") return { item, words: [] as typeof allWords };
    const words = pickUnitWords(
      allWords.map((word) => ({
        id: word.id,
        word: word.word,
        level: word.level,
        topic: word.topic,
        frequencyRank: word.frequencyRank,
      })),
      { title: item.title, level: unit.level, unitOrder: order + 1, count: item.vocabCount ?? 10 },
    );
    const resolved = words
      .map((candidate) => allWords.find((word) => word.id === candidate.id))
      .filter((word) => Boolean(word));
    return { item, words: resolved as typeof allWords };
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BackLink />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[2rem] font-extrabold leading-tight tracking-[-0.02em]">
              {unit.title}
            </h1>
            <p className="max-w-2xl text-[0.9375rem] text-ink-subtle">{unit.description}</p>
          </div>
          {unitDone ? (
            <span className="flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-[0.875rem] font-bold text-primary-deep">
              <CheckCircle2 className="size-4" aria-hidden />
              Unit selesai
            </span>
          ) : (
            <CompleteUnitButton unitId={unit.id} />
          )}
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {unit.items.map((item) => {
          if (item.kind === "grammar") {
            const lesson = completedLessons.find((row) => row.slug === item.refSlug) ?? null;
            const done = lesson ? lessonDone.has(lesson.id) : false;
            return (
              <li key={item.id}>
                <Link
                  href={lesson ? `/materi/${lesson.slug}` : "/materi"}
                  className="clay clay-hover row-hover flex items-center gap-4 p-5"
                >
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-full border-2",
                      done ? "border-primary bg-primary text-white" : "border-hairline bg-surface-muted text-primary",
                    )}
                  >
                    {done ? <CheckCircle2 className="size-5" aria-hidden /> : <BookOpen className="size-5" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[1.0625rem] font-extrabold text-ink">
                      {item.title}
                    </span>
                    <span className="block text-[0.8125rem] text-ink-subtle">
                      {lesson ? lesson.summary : "Materi belum tersedia"}
                      {lesson ? ` · ${lesson.level === "basic" ? "Dasar" : lesson.level === "intermediate" ? "Menengah" : "Lanjut"}` : ""}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                </Link>
              </li>
            );
          }

          const step = vocabSteps.find((entry) => entry.item.id === item.id);
          const words = step?.words ?? [];
          return (
            <li key={item.id}>
              <Link href="/kosakata" className="clay clay-hover row-hover flex items-center gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-hairline bg-surface-muted text-data">
                  <SpellCheck className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[1.0625rem] font-extrabold text-ink">
                    {item.title}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-ink-subtle">
                    {words.length
                      ? words.map((word) => word.word).slice(0, 6).join(", ") + (words.length > 6 ? ", …" : "")
                      : "Kosakata sedang menunggu ulasan"}
                  </span>
                </span>
                <Circle className="size-4 shrink-0 text-ink-faint" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>

      <Link
        href="/belajar"
        className="mx-auto flex h-11 items-center gap-2 rounded-control border-2 border-hairline bg-surface px-5 text-[0.9375rem] font-bold text-ink-subtle transition-colors hover:border-primary hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Peta jalur
      </Link>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/belajar"
      className="flex items-center gap-1.5 text-[0.875rem] font-bold text-ink-subtle transition-colors hover:text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Jalur Belajar
    </Link>
  );
}
