"use client";

import { Check, Clock, Lightbulb, Loader2, Play, Target, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Confetti } from "@/components/fx/confetti";
import { Kaka, Lori } from "@/components/mascot";
import { SpeakButton } from "@/components/speak-button";
import { FieldError, Input, Textarea } from "@/components/ui/field";
import {
  EXERCISE_TYPE_HINT,
  MAX_ANSWER_CHARS,
  parseOptions,
  shuffleWords,
} from "@/lib/grammar-exercise";
import type { GrammarExerciseType } from "@/db/schema";
import { sfx } from "@/lib/sfx";
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

type Result = { correct: boolean; explanation: string | null; answerKey: string | null; xp: number };
type Phase = "idle" | "right" | "wrong";

const PRESS =
  "transition-[transform,box-shadow,filter] duration-150 hover:brightness-[1.03] active:translate-y-1 active:shadow-none disabled:cursor-default";
const CHIP = `${PRESS} rounded-[14px] border-2 border-hairline bg-surface text-ink shadow-[0_4px_0_var(--color-hairline)]`;

export function ExerciseRunner({
  lessonId,
  exercises,
}: {
  /** null saat dipakai di latihan bebas (di luar satu materi). */
  lessonId: number | null;
  exercises: RunnerExercise[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<RunnerExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [answer, setAnswer] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [seconds, setSeconds] = useState(0);
  // id soal -> benar pada percobaan pertama
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({});
  const [solved, setSolved] = useState<number[]>([]);
  const startedAt = useRef(0);

  const current = queue[index] ?? null;
  const wrongList = useMemo(
    () => exercises.filter((e) => firstTry[e.id] === false),
    [exercises, firstTry],
  );
  const allSolved = exercises.every((e) => e.answered?.correct || solved.includes(e.id));

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetStep() {
    setPhase("idle");
    setResult(null);
    setAnswer("");
    setHintOpen(false);
    setError(null);
    setAttempt((n) => n + 1);
  }

  function begin(list: RunnerExercise[], fresh: boolean) {
    setQueue(list);
    setIndex(0);
    setDone(false);
    resetStep();
    if (fresh) {
      setStreak(0);
      setXp(0);
      setFirstTry({});
      setSolved([]);
      startedAt.current = Date.now();
    }
    setOpen(true);
  }

  function start() {
    const todo = exercises.filter((e) => !e.answered?.correct);
    begin(todo.length > 0 ? todo : exercises, true);
  }

  function close() {
    setOpen(false);
    router.refresh();
  }

  async function finish() {
    setSeconds(Math.round((Date.now() - startedAt.current) / 1000));
    setDone(true);
    sfx.levelUp();
    if (lessonId !== null && allSolved) {
      try {
        await markLessonDoneAction(lessonId);
      } catch {
        /* tanda selesai bisa diulang dari halaman materi */
      }
    }
  }

  function next() {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      resetStep();
    } else {
      void finish();
    }
  }

  async function check() {
    if (!current || pending || phase !== "idle") return;
    setPending(true);
    setError(null);
    try {
      const response = await submitExerciseAction(current.id, answer);
      if (response.status === "error") {
        setError(response.message);
        return;
      }
      const gain = response.firstCorrect ? 5 : 0;
      setResult({
        correct: response.correct,
        explanation: response.explanation,
        answerKey: response.answerKey,
        xp: gain,
      });
      setPhase(response.correct ? "right" : "wrong");
      setFirstTry((prev) => (current.id in prev ? prev : { ...prev, [current.id]: response.correct }));
      if (response.correct) {
        setStreak((n) => n + 1);
        setXp((n) => n + gain);
        setSolved((prev) => (prev.includes(current.id) ? prev : [...prev, current.id]));
        sfx.correct();
      } else {
        setStreak(0);
        sfx.wrong();
      }
    } catch {
      setError("Gagal mengirim jawaban. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  const solvedAtOnce = exercises.filter((e) => firstTry[e.id]).length;

  return (
    <>
      <div className="clay flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="text-[0.9375rem] text-ink-subtle">
          {exercises.length} soal · satu soal per layar, dengan penjelasan Lori kalau salah.
        </p>
        <button
          type="button"
          onClick={start}
          className="ledge flex h-14 items-center gap-2 rounded-[16px] bg-primary px-7 font-display text-[1.0625rem] font-extrabold tracking-[0.02em] text-white"
        >
          <Play className="size-5" aria-hidden />
          {exercises.every((e) => e.answered?.correct) ? "ULANGI LATIHAN" : "MULAI LATIHAN"}
        </button>
      </div>

      {open
        ? createPortal(
        <div role="dialog" aria-modal="true" aria-label="Latihan soal" className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-canvas">
          {done ? (
            <DoneScreen
              xp={xp}
              total={exercises.length}
              good={solvedAtOnce}
              seconds={seconds}
              wrongCount={wrongList.length}
              onReview={() => begin(wrongList, false)}
              onClose={close}
            />
          ) : current ? (
            <>
              <header className="mx-auto flex w-full max-w-[1180px] items-center gap-5 px-6 py-6 sm:px-14">
                <button
                  type="button"
                  onClick={close}
                  aria-label="Keluar dari pelajaran"
                  className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[12px] text-ink-subtle hover:bg-surface-muted"
                >
                  <X className="size-6" strokeWidth={2.6} aria-hidden />
                </button>
                <div
                  role="progressbar"
                  aria-label="Kemajuan pelajaran"
                  aria-valuemin={0}
                  aria-valuemax={queue.length}
                  aria-valuenow={index + (phase === "idle" ? 0 : 1)}
                  className="h-[18px] flex-1 overflow-hidden rounded-full bg-hairline"
                >
                  <div
                    className="h-full rounded-full bg-primary shadow-[inset_0_-5px_0_var(--color-primary-deep)] transition-[width] duration-700 ease-out"
                    style={{ width: `${((index + (phase === "idle" ? 0 : 1)) / queue.length) * 100}%` }}
                  />
                </div>
                {streak >= 2 ? (
                  <span className="pop flex shrink-0 items-center gap-1.5 rounded-[12px] bg-mango-soft px-3 py-2 text-[0.9375rem] font-extrabold text-mango-ink">
                    <Zap className="size-4" aria-hidden />
                    {streak} benar beruntun
                  </span>
                ) : null}
              </header>

              <main className="mx-auto flex w-full max-w-[980px] flex-1 flex-col gap-7 px-6 pb-10 pt-2 sm:px-14">
                <div className="rise flex flex-wrap items-center justify-between gap-4">
                  <h1 className="font-display text-[1.625rem] font-black tracking-[-0.02em] sm:text-[2.125rem]">
                    {EXERCISE_TYPE_HINT[current.type]}
                  </h1>
                  {current.hint ? (
                    <button
                      type="button"
                      aria-expanded={hintOpen}
                      onClick={() => setHintOpen((v) => !v)}
                      className={`${PRESS} flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] border-2 border-[#f2c878] bg-mango-soft px-4 text-[0.9375rem] font-extrabold text-mango-ink shadow-[0_3px_0_#f2c878]`}
                    >
                      <Lightbulb className="size-4" aria-hidden />
                      Petunjuk
                    </button>
                  ) : null}
                </div>

                <div className="rise flex items-end gap-3 [--i:1]">
                  <Lori
                    mood={phase === "right" ? "cheer" : phase === "wrong" ? "sad" : "talk"}
                    size={150}
                    className="shrink-0"
                  />
                  <div className="mb-14 flex items-center gap-3.5 rounded-[20px_20px_20px_4px] border-2 border-hairline bg-surface px-5 py-[18px] shadow-[0_4px_0_var(--color-hairline)]">
                    {current.type === "translate" || current.type === "compose" ? null : (
                      <SpeakButton
                        text={current.prompt.replace(/_+/g, "blank")}
                        label="Putar audio kalimat"
                        className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-sky text-white shadow-[0_4px_0_var(--color-sky-deep)]"
                      />
                    )}
                    <p className="text-[1.25rem] font-semibold leading-[1.4] sm:text-[1.375rem]">{current.prompt}</p>
                  </div>
                </div>

                {hintOpen && current.hint ? (
                  <p className="pop -mt-3 rounded-[14px] border-2 border-dashed border-mango-deep bg-mango-soft px-[18px] py-3.5 text-[1rem] text-mango-ink">
                    <strong>Petunjuk Lori:</strong> {current.hint}
                  </p>
                ) : null}

                <StepInput
                  key={`${current.id}-${attempt}`}
                  exercise={current}
                  disabled={phase !== "idle" || pending}
                  phase={phase}
                  onChange={setAnswer}
                  onSubmit={check}
                />
                <FieldError>{error}</FieldError>

                {phase === "wrong" && result ? <Explain answer={answer} result={result} /> : null}
              </main>

              {phase === "idle" ? (
                <footer className="sticky bottom-0 border-t-2 border-hairline bg-surface-muted">
                  <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-14">
                    <button
                      type="button"
                      onClick={next}
                      className="flex min-h-11 cursor-pointer items-center text-[1rem] font-extrabold text-ink-subtle hover:text-ink"
                    >
                      LEWATI
                    </button>
                    <button
                      type="button"
                      onClick={check}
                      disabled={!answer.trim() || pending}
                      className={cn(
                        "ledge flex min-h-14 min-w-[220px] items-center justify-center gap-2 rounded-[16px] px-7 font-display text-[1.1875rem] font-extrabold tracking-[0.02em]",
                        answer.trim()
                          ? "bg-primary text-white"
                          : "bg-hairline text-[#6a6f73] [--ledge:transparent]",
                      )}
                    >
                      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                      PERIKSA
                    </button>
                  </div>
                </footer>
              ) : (
                <footer
                  aria-live="assertive"
                  className={cn(
                    "rise sticky bottom-0 border-t-2",
                    phase === "right" ? "border-[#9fd0b3] bg-primary-soft" : "border-[#efb4a2] bg-brick-soft",
                  )}
                >
                  <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6 px-6 py-5 sm:px-14">
                    <div className={phase === "right" ? "text-primary-deep" : "text-brick-deep"}>
                      <p className="font-display text-[1.5rem] font-black">
                        {phase === "right" ? `Sempurna!${result && result.xp ? ` +${result.xp} XP` : ""}` : "Hampir!"}
                      </p>
                      <p className="mt-1 text-[1rem]">
                        {phase === "right"
                          ? (result?.explanation ?? "Jawabanmu tepat.")
                          : result?.answerKey
                            ? `Jawaban: ${result.answerKey}`
                            : "Lihat penjelasan Lori di atas."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {phase === "wrong" ? (
                        <button
                          type="button"
                          onClick={resetStep}
                          className={`${PRESS} min-h-14 cursor-pointer rounded-[16px] border-2 border-[#efb4a2] bg-surface px-[22px] font-display text-[1.0625rem] font-extrabold text-brick-deep shadow-[0_4px_0_#efb4a2]`}
                        >
                          COBA LAGI
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={next}
                        autoFocus
                        className={cn(
                          "ledge min-h-14 min-w-[200px] cursor-pointer rounded-[16px] px-7 font-display text-[1.1875rem] font-extrabold tracking-[0.02em] text-white",
                          phase === "right" ? "bg-primary" : "bg-brick [--ledge:var(--color-brick-deep)]",
                        )}
                      >
                        LANJUT
                      </button>
                    </div>
                  </div>
                </footer>
              )}
            </>
          ) : null}
        </div>,
        document.body,
      )
        : null}
    </>
  );
}

/** Panel "Lori jelaskan" setelah jawaban salah. */
function Explain({ answer, result }: { answer: string; result: Result }) {
  return (
    <section aria-label="Lori jelaskan" className="rise flex flex-col gap-3 rounded-[20px] border-2 border-hairline bg-surface p-5 shadow-[0_4px_0_var(--color-hairline)]">
      <p className="text-[0.8125rem] font-extrabold tracking-[0.08em] text-brick-deep">JAWABANMU</p>
      <p className="w-fit rounded-[8px] bg-brick-soft px-2 py-0.5 text-[1.25rem] font-bold text-brick-deep line-through decoration-brick decoration-[3px]">
        {answer}
      </p>
      {result.answerKey ? (
        <>
          <p className="text-[0.8125rem] font-extrabold tracking-[0.08em] text-primary-deep">YANG BENAR</p>
          <p className="w-fit rounded-[8px] bg-primary-soft px-2 py-0.5 text-[1.25rem] font-bold text-primary-deep">
            {result.answerKey}
          </p>
        </>
      ) : null}
      {result.explanation ? <p className="text-[1rem] leading-relaxed text-ink-muted">{result.explanation}</p> : null}
      <Link href="/tutor" className="flex min-h-11 w-fit items-center font-extrabold text-primary hover:underline">
        Masih bingung? Tanya Tutor AI
      </Link>
    </section>
  );
}

function StepInput({
  exercise,
  disabled,
  phase,
  onChange,
  onSubmit,
}: {
  exercise: RunnerExercise;
  disabled: boolean;
  phase: Phase;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const options = parseOptions(exercise.options);

  if (exercise.type === "choice") {
    return (
      <div role="radiogroup" aria-label="Pilihan jawaban" className="grid gap-3 sm:grid-cols-2">
        {options.map((option, i) => {
          const chosen = picked === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={disabled}
              onClick={() => {
                setPicked(i);
                onChange(option);
                sfx.tap();
              }}
              className={cn(
                PRESS,
                "flex min-h-16 cursor-pointer items-center gap-3 rounded-[16px] border-2 px-5 text-left text-[1.125rem] font-bold shadow-[0_4px_0_var(--color-hairline)]",
                chosen && phase === "idle" && "border-sky bg-sky-soft text-sky-deep shadow-[0_4px_0_var(--color-sky)]",
                chosen && phase === "right" && "border-primary bg-primary-soft text-primary-deep shadow-[0_4px_0_var(--color-primary)]",
                chosen && phase === "wrong" && "border-brick bg-brick-soft text-brick-deep shadow-[0_4px_0_var(--color-brick)]",
                !chosen && "border-hairline bg-surface hover:border-sky",
              )}
            >
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-[10px] border-2 border-current text-[0.875rem] font-extrabold"
              >
                {i + 1}
              </span>
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  if (exercise.type === "arrange") {
    return <ArrangeInput exercise={exercise} disabled={disabled} phase={phase} onChange={onChange} />;
  }

  const multiline = exercise.type === "translate" || exercise.type === "compose";
  const common = {
    value,
    maxLength: MAX_ANSWER_CHARS,
    disabled,
    placeholder: "Tulis jawabanmu di sini",
    "aria-label": "Jawaban",
    onChange: (event: { target: { value: string } }) => {
      setValue(event.target.value);
      onChange(event.target.value);
    },
    className: cn(
      "text-[1.25rem]",
      phase === "right" && "border-primary",
      phase === "wrong" && "border-brick",
    ),
  };
  return multiline ? (
    <Textarea
      rows={3}
      {...common}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) onSubmit();
      }}
    />
  ) : (
    <Input
      {...common}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSubmit();
      }}
    />
  );
}

/** Susun kata: bank kata di bawah, jawaban di garis atas (seperti mockup). */
function ArrangeInput({
  exercise,
  disabled,
  phase,
  onChange,
}: {
  exercise: RunnerExercise;
  disabled: boolean;
  phase: Phase;
  onChange: (value: string) => void;
}) {
  const words = useMemo(
    () => shuffleWords(parseOptions(exercise.options), exercise.id),
    [exercise.options, exercise.id],
  );
  const [picked, setPicked] = useState<number[]>([]);

  function update(next: number[]) {
    setPicked(next);
    onChange(next.map((i) => words[i]).join(" "));
  }

  return (
    <>
      <section aria-label="Jawabanmu" className={cn("flex min-h-[140px] flex-col", phase === "wrong" && "shake")}>
        <div className="flex min-h-16 flex-wrap gap-2.5 border-b-2 border-hairline-strong py-2" aria-live="polite">
          {picked.map((wordIndex, pos) => (
            <button
              key={`${wordIndex}-${pos}`}
              type="button"
              disabled={disabled}
              aria-label={`Hapus kata ${words[wordIndex]}`}
              onClick={() => update(picked.filter((_, p) => p !== pos))}
              className={cn(
                CHIP,
                "pop min-h-[52px] cursor-pointer px-[18px] text-[1.25rem] font-bold",
                phase === "right" && "border-primary bg-primary-soft",
                phase === "wrong" && "border-brick bg-brick-soft",
              )}
            >
              {words[wordIndex]}
            </button>
          ))}
        </div>
        <div className="mt-[62px] h-0.5 bg-hairline-strong" />
      </section>
      <section aria-label="Bank kata" className="flex flex-wrap justify-center gap-2.5">
        {words.map((word, i) =>
          picked.includes(i) ? (
            <span
              key={i}
              aria-hidden
              className="inline-block min-h-[52px] rounded-[14px] bg-hairline px-[18px] text-[1.25rem] font-bold leading-[52px] text-transparent"
            >
              {word}
            </span>
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => {
                update([...picked, i]);
                sfx.tap();
              }}
              className={cn(CHIP, "min-h-[52px] cursor-pointer px-[18px] text-[1.25rem] font-bold")}
            >
              {word}
            </button>
          ),
        )}
      </section>
    </>
  );
}

function DoneScreen({
  xp,
  total,
  good,
  seconds,
  wrongCount,
  onReview,
  onClose,
}: {
  xp: number;
  total: number;
  good: number;
  seconds: number;
  wrongCount: number;
  onReview: () => void;
  onClose: () => void;
}) {
  const accuracy = total > 0 ? Math.round((good / total) * 100) : 0;
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const stats = [
    { label: "TOTAL XP", value: xp, bg: "bg-mango", labelInk: "text-[#3a2400]", ink: "text-[#a86a12]", Icon: Zap },
    { label: "AKURASI", value: `${accuracy}%`, bg: "bg-primary", labelInk: "text-white", ink: "text-primary-deep", Icon: Target },
    { label: "WAKTU", value: time, bg: "bg-sky", labelInk: "text-white", ink: "text-sky-deep", Icon: Clock },
    { label: "BENAR", value: `${good}/${total}`, bg: "bg-brick", labelInk: "text-white", ink: "text-brick-deep", Icon: Check },
  ];
  return (
    <>
      <main className="relative mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center gap-6 px-6 pb-8 pt-10 sm:px-14">
        <Confetti count={44} />
        <div className="relative flex h-[260px] items-end justify-center gap-10">
          <Lori mood="cheer" size={240} label="Lori melompat gembira" />
          <Kaka mood="proud" size={170} label="Kaka bangga" className="mb-2" />
        </div>
        <div className="pop text-center [--i:3]">
          <h1 className="font-display text-[2.5rem] font-black tracking-[-0.035em] text-primary sm:text-[3.5rem]">
            Pelajaran beres!
          </h1>
          <p className="mt-1.5 text-[1.1875rem] text-ink-subtle">
            {wrongCount === 0 ? "Semua benar. Kaka bilang: “Lumayan. Besok lebih cepat.”" : `Ada ${wrongCount} soal yang bisa ditinjau lagi.`}
          </p>
        </div>
        <ul className="grid w-full max-w-[860px] grid-cols-2 gap-3.5 sm:grid-cols-4">
          {stats.map((s, i) => (
            <li key={s.label} className={cn("pop overflow-hidden rounded-[20px] p-[3px]", s.bg)} style={{ "--i": 4 + i } as React.CSSProperties}>
              <p className={cn("py-2 text-center text-[0.8125rem] font-black tracking-[0.08em]", s.labelInk)}>{s.label}</p>
              <p className={cn("flex items-center justify-center gap-2 rounded-t-[16px] bg-surface px-2 py-4 font-display text-[1.875rem] font-black", s.ink)}>
                <s.Icon className="size-6" aria-hidden />
                {s.value}
              </p>
            </li>
          ))}
        </ul>
      </main>
      <footer className="sticky bottom-0 border-t-2 border-hairline bg-surface-muted">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-14">
          {wrongCount > 0 ? (
            <button
              type="button"
              onClick={onReview}
              className={`${PRESS} min-h-14 cursor-pointer rounded-[16px] border-2 border-hairline bg-surface px-[22px] font-display text-[1.0625rem] font-extrabold shadow-[0_4px_0_var(--color-hairline)]`}
            >
              TINJAU {wrongCount} KESALAHAN
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="ledge min-h-14 min-w-[240px] cursor-pointer rounded-[16px] bg-primary px-7 font-display text-[1.1875rem] font-extrabold tracking-[0.02em] text-white"
          >
            LANJUT
          </button>
        </div>
      </footer>
    </>
  );
}
