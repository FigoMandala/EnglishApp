"use client";

import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import {
  EXERCISE_TYPE_HINT,
  EXERCISE_TYPE_LABEL,
  MAX_ANSWER_CHARS,
  parseOptions,
  shuffleWords,
} from "@/lib/grammar-exercise";
import type { GrammarExerciseType } from "@/db/schema";
import { cn } from "@/lib/utils";

import { submitExerciseAction } from "../actions";
import { markLessonDoneAction } from "../../belajar/actions";

export type RunnerExercise = {
  id: number;
  type: GrammarExerciseType;
  prompt: string;
  hint: string | null;
  options: string | null;
  answered: { answer: string; correct: boolean } | null;
};

type Result = { correct: boolean; explanation: string | null };

export function ExerciseRunner({
  lessonId,
  exercises,
}: {
  lessonId: number;
  exercises: RunnerExercise[];
}) {
  const router = useRouter();
  const [results, setResults] = useState<Record<number, Result>>({});
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);

  const allCorrect =
    exercises.length > 0 &&
    exercises.every(
      (exercise) => results[exercise.id]?.correct || exercise.answered?.correct,
    );

  async function markDone() {
    setMarking(true);
    try {
      await markLessonDoneAction(lessonId);
      setMarked(true);
      router.refresh();
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {exercises.map((exercise, index) => (
        <ExerciseCard
          key={exercise.id}
          index={index + 1}
          exercise={exercise}
          result={results[exercise.id] ?? null}
          onResult={(result) =>
            setResults((prev) => ({ ...prev, [exercise.id]: result }))
          }
        />
      ))}

      {exercises.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={marking || marked || !allCorrect} onClick={markDone}>
            {marked ? <Check className="size-4" aria-hidden /> : null}
            {marked ? "Materi ditandai selesai" : "Tandai materi selesai"}
          </Button>
          {!allCorrect ? (
            <span className="text-[0.875rem] text-ink-subtle">
              Jawab semua soal dengan benar untuk membuka tombol ini.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExerciseCard({
  index,
  exercise,
  result,
  onResult,
}: {
  index: number;
  exercise: RunnerExercise;
  result: Result | null;
  onResult: (result: Result) => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const shuffled = useRef<string[] | null>(null);

  if (exercise.type === "arrange" && shuffled.current === null) {
    const words = parseOptions(exercise.options);
    shuffled.current = shuffleWords(words, exercise.id);
  }

  const options = parseOptions(exercise.options);
  const previous = exercise.answered;

  async function submit(answer: string) {
    setPending(true);
    setError(null);
    try {
      const response = await submitExerciseAction(exercise.id, answer);
      if (response.status === "error") {
        setError(response.message);
        return;
      }
      onResult({ correct: response.correct, explanation: response.explanation });
    } catch {
      setError("Gagal mengirim jawaban. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  const correctText = result?.correct ?? previous?.correct ?? null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-plate border-2 p-5",
        correctText === true && "border-primary/50 bg-primary-soft/40",
        correctText === false && "border-hairline bg-surface",
        correctText === null && "border-hairline bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.9375rem] font-bold leading-snug text-ink">
          <span className="mr-2 tnum text-ink-faint">{index}.</span>
          {exercise.prompt}
        </p>
        <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wide text-ink-subtle">
          {EXERCISE_TYPE_LABEL[exercise.type]}
        </span>
      </div>
      <p className="text-[0.8125rem] text-ink-faint">{EXERCISE_TYPE_HINT[exercise.type]}</p>
      {exercise.hint ? (
        <p className="rounded-control bg-surface-muted px-3 py-2 text-[0.8125rem] italic text-ink-subtle">
          {exercise.hint}
        </p>
      ) : null}

      {exercise.type === "choice" ? (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Pilihan jawaban">
          {options.map((option, optionIndex) => {
            const chosen = picked === optionIndex;
            const showCorrect = result && chosen && result.correct;
            const showWrong = result && chosen && !result.correct;
            return (
              <button
                key={optionIndex}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={pending || Boolean(result)}
                onClick={() => {
                  setPicked(optionIndex);
                  submit(option);
                }}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-control border-2 px-4 text-left text-[0.9375rem] font-semibold transition-colors disabled:cursor-default",
                  chosen
                    ? showCorrect
                      ? "border-primary bg-primary-soft text-primary-deep"
                      : showWrong
                        ? "border-negative/50 bg-negative-soft text-negative"
                        : "border-primary bg-surface-muted"
                    : "border-hairline bg-surface-muted hover:border-primary",
                )}
              >
                {showCorrect ? <Check className="size-4 shrink-0" aria-hidden /> : null}
                {showWrong ? <X className="size-4 shrink-0" aria-hidden /> : null}
                {option}
              </button>
            );
          })}
        </div>
      ) : exercise.type === "arrange" ? (
        <ArrangeInput
          words={shuffled.current ?? []}
          disabled={pending || Boolean(result)}
          onSubmit={(answer) => submit(answer)}
        />
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(value);
          }}
        >
          <div className="min-w-[240px] flex-1">
            <Label htmlFor={id} className="sr-only">
              Jawaban
            </Label>
            <Input
              id={id}
              value={value}
              maxLength={MAX_ANSWER_CHARS}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Tulis jawabanmu di sini"
              disabled={pending || Boolean(result)}
              className={cn(
                result?.correct === true && "border-primary",
                result && !result.correct && "border-negative/50",
              )}
            />
          </div>
          <Button type="submit" disabled={pending || Boolean(result) || !value.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Periksa
          </Button>
        </form>
      )}

      {result?.explanation ? (
        <p
          className={cn(
            "rounded-control px-3 py-2 text-[0.875rem] leading-snug",
            result.correct ? "bg-primary-soft text-primary-deep" : "bg-surface-muted text-ink-subtle",
          )}
        >
          {result.explanation}
        </p>
      ) : null}
      {result && !result.correct ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            setPicked(null);
            onResult({ correct: false, explanation: null });
          }}
          className="flex w-fit items-center gap-1.5 text-[0.8125rem] font-bold text-primary hover:underline"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Coba lagi
        </button>
      ) : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Susun kata: klik kata untuk menambah ke kalimat, klik lagi untuk mengembalikan. */
function ArrangeInput({
  words,
  disabled,
  onSubmit,
}: {
  words: string[];
  disabled: boolean;
  onSubmit: (answer: string) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);

  const sentence = picked.map((index) => words[index]).join(" ");

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border-2 border-dashed border-hairline bg-surface-muted p-2"
        aria-live="polite"
      >
        {picked.length === 0 ? (
          <span className="px-2 text-[0.875rem] text-ink-faint">Klik kata di bawah untuk menyusun…</span>
        ) : (
          picked.map((wordIndex, position) => (
            <button
              key={`${wordIndex}-${position}`}
              type="button"
              disabled={disabled}
              onClick={() => setPicked((prev) => prev.filter((_, i) => i !== position))}
              className="rounded-[10px] bg-surface px-3 py-1.5 text-[0.9375rem] font-semibold shadow-card"
            >
              {words[wordIndex]}
            </button>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {words.map((word, wordIndex) => {
          const used = picked.includes(wordIndex);
          return (
            <button
              key={`${word}-${wordIndex}`}
              type="button"
              disabled={disabled || used}
              onClick={() => setPicked((prev) => [...prev, wordIndex])}
              className={cn(
                "rounded-[10px] border-2 px-3 py-1.5 text-[0.9375rem] font-semibold transition-colors",
                used
                  ? "border-hairline bg-canvas-deep text-ink-faint"
                  : "border-hairline bg-surface hover:border-primary",
              )}
            >
              {word}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        disabled={disabled || picked.length === 0}
        onClick={() => onSubmit(sentence)}
      >
        Periksa
      </Button>
    </div>
  );
}
