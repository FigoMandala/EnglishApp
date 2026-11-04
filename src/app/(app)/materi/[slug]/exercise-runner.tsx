"use client";

import { Check, Clock, Lightbulb, Loader2, Play, Target, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Confetti } from "@/components/fx/confetti";
import { Lori } from "@/components/mascot";
import { SpeakButton } from "@/components/speak-button";
import { Anatomy, blankAnatomy } from "@/components/ui/anatomy";
import { FieldError, Input, Textarea } from "@/components/ui/field";
import type { GrammarExerciseType } from "@/db/schema";
import { EXERCISE_TYPE_HINT, MAX_ANSWER_CHARS, parseOptions, shuffleWords } from "@/lib/grammar-exercise";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

import { markLessonDoneAction } from "../../belajar/actions";
import { submitExerciseAction } from "../actions";

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

const PRESS = "transition-[transform,box-shadow,filter] duration-150 active:translate-y-[5px] active:shadow-none disabled:cursor-default";
const CHIP = `${PRESS} rounded-[12px] border-2 border-hairline bg-surface text-ink shadow-[0_3px_0_var(--color-hairline)]`;
const KEYS = ["A", "B", "C", "D", "E", "F"];

const TYPE_LABEL: Record<GrammarExerciseType, string> = {
  fill: "Isi rumpang",
  choice: "Pilihan ganda",
  arrange: "Susun kata",
  translate: "Terjemahkan",
  compose: "Tulis kalimat",
};

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
  const [explainOpen, setExplainOpen] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [xpFloat, setXpFloat] = useState<{ gain: number; n: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  // id soal -> benar pada percobaan pertama
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({});
  const [solved, setSolved] = useState<number[]>([]);
  const startedAt = useRef(0);

  const current = queue[index] ?? null;
  const wrongList = useMemo(() => exercises.filter((e) => firstTry[e.id] === false), [exercises, firstTry]);
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
    setExplainOpen(true);
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
        if (gain > 0) setXpFloat((f) => ({ gain, n: (f?.n ?? 0) + 1 }));
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
  const segments = queue.map((exercise, i) => {
    if (i < index || (i === index && phase !== "idle")) {
      const ok = i === index ? phase === "right" : firstTry[exercise.id] !== false;
      return ok ? "bg-primary" : "bg-brick";
    }
    return i === index ? "bg-sky" : "bg-hairline";
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-plate border-2 border-dashed border-hairline-strong bg-surface-muted p-5">
        <p className="text-[0.9375rem] text-ink-subtle">
          <strong className="text-ink">{exercises.length} soal</strong> · satu soal per layar. Kalau salah, Lori bedah
          kalimatnya.
        </p>
        <button
          type="button"
          onClick={start}
          className={`${PRESS} flex h-[52px] cursor-pointer items-center gap-2 rounded-[16px] bg-primary px-6 font-display text-[1rem] font-extrabold tracking-[0.03em] text-white shadow-[0_5px_0_var(--color-primary-deep)]`}
        >
          <Play className="size-5 fill-white" aria-hidden />
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
                  <header className="border-b-2 border-hairline">
                    <div className="mx-auto flex w-full max-w-[1040px] items-center gap-[18px] px-6 py-4">
                      <button
                        type="button"
                        onClick={close}
                        aria-label="Keluar dari pelajaran"
                        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[12px] text-ink-subtle hover:bg-surface"
                      >
                        <X className="size-6" strokeWidth={2.6} aria-hidden />
                      </button>
                      <div
                        role="progressbar"
                        aria-label={`Kemajuan pelajaran, soal ${index + 1} dari ${queue.length}`}
                        aria-valuemin={0}
                        aria-valuemax={queue.length}
                        aria-valuenow={index + (phase === "idle" ? 0 : 1)}
                        className="grid flex-1 gap-1"
                        style={{ gridTemplateColumns: `repeat(${queue.length}, minmax(0, 1fr))` }}
                      >
                        {segments.map((tone, i) => (
                          <span key={i} className={cn("h-3 rounded-[4px] transition-colors", tone)} />
                        ))}
                      </div>
                      {streak >= 2 ? (
                        <span className="pop hidden shrink-0 items-center gap-1 rounded-full bg-charcoal px-3 py-1 text-[0.8125rem] font-extrabold text-mango-line sm:flex">
                          {streak} beruntun
                        </span>
                      ) : null}
                      <span className="relative flex shrink-0 items-center gap-1 font-round text-[1.25rem] font-extrabold text-mango-deep">
                        <Zap className="size-[18px] fill-mango text-mango" aria-hidden />
                        {xp}
                        {xpFloat?.gain ? (
                          <span
                            key={xpFloat.n}
                            aria-hidden
                            className="xp-float absolute -top-2 right-0 font-round text-[0.9375rem] font-extrabold text-mango"
                          >
                            +{xpFloat.gain}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </header>

                  <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-6 pb-10 pt-10">
                    <div className="rise flex flex-wrap items-center justify-between gap-3">
                      <span className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-hairline bg-surface px-3 py-1 text-[0.8125rem] font-extrabold text-ink-muted">
                          <span aria-hidden className="size-2 rounded-full bg-primary" />
                          {TYPE_LABEL[current.type]}
                        </span>
                        <span className="text-[0.875rem] font-bold text-ink-subtle">{EXERCISE_TYPE_HINT[current.type]}</span>
                      </span>
                      {current.hint ? (
                        <button
                          type="button"
                          aria-expanded={hintOpen}
                          onClick={() => setHintOpen((v) => !v)}
                          className={`${PRESS} flex min-h-10 cursor-pointer items-center gap-2 rounded-[12px] border-2 border-mango-line bg-mango-soft px-3.5 text-[0.875rem] font-extrabold text-mango-ink shadow-[0_3px_0_var(--color-mango-line)]`}
                        >
                          <Lightbulb className="size-4" aria-hidden />
                          Petunjuk
                        </button>
                      ) : null}
                    </div>

                    <div className="rise flex items-start gap-3 [--i:1]">
                      {current.type === "translate" || current.type === "compose" ? null : (
                        <SpeakButton
                          text={current.prompt.replace(/_+/g, "blank")}
                          label="Putar audio kalimat"
                          className="mt-1 size-11 rounded-[12px] bg-sky text-white shadow-[0_3px_0_var(--color-sky-deep)] hover:bg-sky hover:text-white"
                        />
                      )}
                      <p className="text-[1.5rem] font-semibold leading-[1.45] sm:text-[1.75rem]">{current.prompt}</p>
                    </div>

                    {hintOpen && current.hint ? (
                      <p className="pop rounded-[14px] border-2 border-dashed border-mango-deep bg-mango-soft px-[18px] py-3.5 text-[1rem] text-mango-ink">
                        <strong>Petunjuk Lori:</strong> {current.hint}
                      </p>
                    ) : null}

                    <StepInput
                      key={`${current.id}-${attempt}`}
                      exercise={current}
                      disabled={phase !== "idle" || pending}
                      phase={phase}
                      answerKey={result?.answerKey ?? null}
                      onChange={setAnswer}
                      onSubmit={check}
                    />
                    <FieldError>{error}</FieldError>

                    {phase === "wrong" && result && explainOpen ? (
                      <Explain prompt={current.prompt} answer={answer} result={result} />
                    ) : null}
                  </main>

                  {phase === "idle" ? (
                    <footer className="sticky bottom-0 border-t-2 border-hairline bg-canvas">
                      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-4 px-6 py-5">
                        <button
                          type="button"
                          onClick={next}
                          className={`${PRESS} h-[54px] cursor-pointer rounded-[16px] border-2 border-hairline bg-surface px-[22px] font-display text-[1rem] font-extrabold text-ink-muted shadow-[0_4px_0_var(--color-hairline)]`}
                        >
                          LEWATI
                        </button>
                        <button
                          type="button"
                          onClick={check}
                          disabled={!answer.trim() || pending}
                          className={cn(
                            PRESS,
                            "flex h-[54px] min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-[16px] px-10 font-display text-[1.0625rem] font-extrabold tracking-[0.03em]",
                            answer.trim()
                              ? "bg-primary text-white shadow-[0_5px_0_var(--color-primary-deep)]"
                              : "bg-hairline text-ink-faint shadow-[0_5px_0_var(--color-hairline-strong)]",
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
                        "pop-in sticky bottom-0 border-t-2",
                        phase === "right" ? "border-primary-line bg-primary-soft" : "border-brick-line bg-brick-soft",
                      )}
                    >
                      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-4 px-6 py-5">
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-[52px] shrink-0 place-items-center rounded-full text-white",
                            phase === "right" ? "bg-primary" : "bg-brick",
                          )}
                        >
                          {phase === "right" ? <Check className="size-7" strokeWidth={3} /> : <X className="size-7" strokeWidth={3} />}
                        </span>
                        <div className={cn("min-w-0 flex-[1_1_260px]", phase === "right" ? "text-primary-deep" : "text-brick-deep")}>
                          <p className="font-display text-[1.5rem] font-black">
                            {phase === "right" ? `Mantap, tepat!${result && result.xp ? ` +${result.xp} XP` : ""}` : "Hampir!"}
                          </p>
                          <p className="text-[0.9375rem]">
                            {phase === "right"
                              ? (result?.explanation ?? "Jawabanmu tepat.")
                              : result?.answerKey
                                ? `Yang benar: ${result.answerKey}. Soal ini masuk Bank Kesalahan.`
                                : "Lihat penjelasan Lori di atas."}
                          </p>
                        </div>
                        {phase === "wrong" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setExplainOpen((v) => !v)}
                              className="h-[54px] cursor-pointer rounded-[16px] border-2 border-brick-line bg-surface px-[18px] text-[0.9375rem] font-extrabold text-brick-deep"
                            >
                              {explainOpen ? "Sembunyikan penjelasan" : "Lori jelaskan"}
                            </button>
                            <button
                              type="button"
                              onClick={resetStep}
                              className={`${PRESS} h-[54px] cursor-pointer rounded-[16px] border-2 border-brick-line bg-surface px-[18px] font-display text-[1rem] font-extrabold text-brick-deep shadow-[0_4px_0_var(--color-brick-line)]`}
                            >
                              COBA LAGI
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={next}
                          autoFocus
                          className={cn(
                            PRESS,
                            "h-[54px] min-w-[160px] cursor-pointer rounded-[16px] px-9 font-display text-[1.0625rem] font-extrabold tracking-[0.03em] text-white",
                            phase === "right"
                              ? "bg-primary shadow-[0_5px_0_var(--color-primary-deep)]"
                              : "bg-brick shadow-[0_5px_0_var(--color-brick-deep)]",
                          )}
                        >
                          {phase === "right" ? "LANJUT" : "MENGERTI"}
                        </button>
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

/** Panel "Lori bedah kalimatnya" setelah jawaban salah. */
function Explain({ prompt, answer, result }: { prompt: string; answer: string; result: Result }) {
  const parts = blankAnatomy(prompt, answer, result.answerKey);
  return (
    <section
      aria-label="Penjelasan Lori"
      className="rise flex flex-col gap-4 rounded-[24px] border-2 border-hairline bg-surface p-6 shadow-card"
    >
      <div className="flex items-center gap-3">
        <Lori mood="talk" size={56} />
        <div>
          <strong className="block font-display text-[1.1875rem]">Lori bedah kalimatnya</strong>
          <span className="text-[0.875rem] text-ink-subtle">Bandingkan jawabanmu dengan yang benar</span>
        </div>
      </div>
      {parts ? (
        <Anatomy parts={parts} size="md" />
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="eyebrow text-brick-deep">Jawabanmu</p>
          <p className="w-fit rounded-[8px] border-b-4 border-brick bg-brick-soft px-2 py-0.5 text-[1.125rem] font-bold text-brick-deep line-through decoration-[3px]">
            {answer}
          </p>
          {result.answerKey ? (
            <>
              <p className="eyebrow text-primary-deep">Yang benar</p>
              <p className="w-fit rounded-[8px] border-b-4 border-primary bg-primary-soft px-2 py-0.5 text-[1.125rem] font-bold text-primary-deep">
                {result.answerKey}
              </p>
            </>
          ) : null}
        </div>
      )}
      {result.explanation ? <p className="text-[1rem] leading-relaxed text-ink-muted">{result.explanation}</p> : null}
      <Link
        href="/tutor"
        className="flex h-10 w-fit items-center rounded-[12px] border-2 border-hairline px-3.5 text-[0.875rem] font-extrabold text-primary-deep hover:border-primary-line"
      >
        Masih bingung? Tanya lanjut ke Lori
      </Link>
    </section>
  );
}

function StepInput({
  exercise,
  disabled,
  phase,
  answerKey,
  onChange,
  onSubmit,
}: {
  exercise: RunnerExercise;
  disabled: boolean;
  phase: Phase;
  answerKey: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const options = parseOptions(exercise.options);

  // Pilihan ganda: tombol 1–4 di keyboard memilih opsi.
  useEffect(() => {
    if (exercise.type !== "choice" || disabled) return;
    const onKey = (event: KeyboardEvent) => {
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) {
        setPicked(n - 1);
        onChange(options[n - 1]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [exercise.type, disabled, options, onChange]);

  if (exercise.type === "choice") {
    const keyNorm = answerKey?.trim().toLowerCase() ?? null;
    return (
      <div role="radiogroup" aria-label="Pilihan jawaban" className="grid gap-3 sm:grid-cols-2">
        {options.map((option, i) => {
          const chosen = picked === i;
          const isKey = keyNorm !== null && option.trim().toLowerCase() === keyNorm;
          const state =
            phase === "idle"
              ? chosen
                ? "picked"
                : "base"
              : (phase === "right" && chosen) || isKey
                ? "right"
                : chosen
                  ? "wrong"
                  : "muted";
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
                "flex min-h-16 cursor-pointer items-center gap-3.5 rounded-[18px] border-2 px-[18px] text-left text-[1.125rem] font-bold",
                state === "base" && "border-hairline bg-surface shadow-[0_4px_0_var(--color-hairline)] hover:border-sky-line",
                state === "picked" && "border-sky bg-sky-soft text-sky-deep shadow-[0_4px_0_var(--color-sky-line)]",
                state === "right" && "border-primary bg-primary-soft text-primary-deep shadow-[0_4px_0_var(--color-primary-line)]",
                state === "wrong" && "border-brick bg-brick-soft text-brick-deep line-through decoration-2 shadow-[0_4px_0_var(--color-brick-line)]",
                state === "muted" && "border-hairline bg-surface-muted font-semibold text-ink-faint",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-[9px] text-[0.875rem] font-extrabold no-underline",
                  state === "base" && "border-2 border-hairline text-ink-subtle",
                  state === "picked" && "bg-sky text-white",
                  state === "right" && "bg-primary text-white",
                  state === "wrong" && "bg-brick text-white",
                  state === "muted" && "border-2 border-hairline",
                )}
              >
                {state === "right" ? <Check className="size-4" strokeWidth={3} /> : state === "wrong" ? <X className="size-4" strokeWidth={3} /> : KEYS[i]}
              </span>
              <span className="flex-1">{option}</span>
              {state === "right" ? <span className="text-[0.75rem] font-extrabold">BENAR</span> : null}
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
      "h-14 bg-surface text-[1.25rem]",
      phase === "right" && "border-primary bg-primary-soft",
      phase === "wrong" && "border-brick bg-brick-soft",
    ),
  };
  return multiline ? (
    <Textarea
      rows={3}
      {...common}
      className={cn(common.className, "h-auto")}
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

/** Susun kata: bank kata di bawah, jawaban di garis atas. Kata terpakai meninggalkan "bayangan". */
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
  const words = useMemo(() => shuffleWords(parseOptions(exercise.options), exercise.id), [exercise.options, exercise.id]);
  const [picked, setPicked] = useState<number[]>([]);

  function update(next: number[]) {
    setPicked(next);
    onChange(next.map((i) => words[i]).join(" "));
  }

  return (
    <div className="flex flex-col gap-6 rounded-plate border-2 border-hairline bg-surface p-5">
      <section aria-label="Jawabanmu" className={cn("flex min-h-[124px] flex-col", phase === "wrong" && "shake")}>
        <div className="flex min-h-[60px] flex-wrap gap-2 border-b-2 border-hairline-strong pb-2" aria-live="polite">
          {picked.map((wordIndex, pos) => (
            <button
              key={wordIndex}
              type="button"
              disabled={disabled}
              aria-label={`Hapus kata ${words[wordIndex]}`}
              onClick={() => update(picked.filter((_, p) => p !== pos))}
              className={cn(
                CHIP,
                "min-h-12 cursor-pointer px-4 text-[1.125rem] font-bold transition-colors duration-200",
                phase === "right" && "border-primary bg-primary-soft",
                phase === "wrong" && "border-brick bg-brick-soft",
              )}
            >
              {words[wordIndex]}
            </button>
          ))}
          {picked.length === 0 ? (
            <span className="self-center rounded-[12px] border-2 border-dashed border-hairline-strong px-4 py-2 font-bold text-ink-faint">
              Ketuk kata di bawah…
            </span>
          ) : null}
        </div>
        <div className="mt-[56px] h-0.5 bg-hairline-strong" />
      </section>
      <section aria-label="Bank kata" className="flex flex-wrap justify-center gap-2">
        {words.map((word, i) =>
          picked.includes(i) ? (
            <span
              key={i}
              aria-hidden
              className="inline-block min-h-12 rounded-[12px] bg-canvas-deep px-4 text-[1.125rem] font-bold leading-[48px] text-transparent"
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
              className={cn(CHIP, "min-h-12 cursor-pointer px-4 text-[1.125rem] font-bold")}
            >
              {word}
            </button>
          ),
        )}
      </section>
    </div>
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
    { label: "TOTAL XP", value: xp, head: "bg-mango text-mango-on", box: "border-mango-line bg-mango-soft text-mango-ink", Icon: Zap },
    { label: "AKURASI", value: `${accuracy}%`, head: "bg-primary text-white", box: "border-primary-line bg-primary-soft text-primary-deep", Icon: Target },
    { label: "WAKTU", value: time, head: "bg-sky text-white", box: "border-sky-line bg-sky-soft text-sky-deep", Icon: Clock },
  ];
  return (
    <>
      <main className="relative mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center gap-6 px-6 pb-8 pt-12 text-center">
        <Confetti count={44} />
        <div aria-hidden className="absolute left-1/2 top-8 size-[460px] -translate-x-1/2 rounded-full bg-canvas-deep" />
        <Lori mood="cheer" size={200} label="Lori melompat gembira" className="relative" />
        <div className="pop relative [--i:3]">
          <h1 className="font-display text-[2.5rem] font-black leading-[1.05] tracking-[-0.03em] sm:text-[3rem]">Pelajaran beres!</h1>
          <p className="mt-1.5 text-[1.125rem] text-ink-muted">
            {wrongCount === 0
              ? `Semua ${total} soal benar di percobaan pertama.`
              : `${good}/${total} benar di percobaan pertama. ${wrongCount} soal bisa ditinjau lagi.`}
          </p>
        </div>
        <ul className="relative grid w-full grid-cols-3 gap-3.5">
          {stats.map((s, i) => (
            <li
              key={s.label}
              className={cn("pop overflow-hidden rounded-plate border-2", s.box)}
              style={{ "--i": 4 + i } as React.CSSProperties}
            >
              <p className={cn("py-1.5 text-[0.75rem] font-extrabold tracking-[0.08em]", s.head)}>{s.label}</p>
              <p className="flex items-center justify-center gap-1.5 px-2 py-4 font-round text-[2.25rem] font-extrabold leading-none">
                <s.Icon className="size-6" aria-hidden />
                {s.value}
              </p>
            </li>
          ))}
        </ul>
      </main>
      <footer className="sticky bottom-0 border-t-2 border-hairline bg-canvas">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          {wrongCount > 0 ? (
            <button
              type="button"
              onClick={onReview}
              className={`${PRESS} h-[54px] cursor-pointer rounded-[16px] border-2 border-hairline bg-surface px-[22px] font-display text-[1rem] font-extrabold shadow-[0_4px_0_var(--color-hairline)]`}
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
            className={`${PRESS} h-[54px] min-w-[220px] cursor-pointer rounded-[16px] bg-primary px-8 font-display text-[1.0625rem] font-extrabold tracking-[0.03em] text-white shadow-[0_5px_0_var(--color-primary-deep)]`}
          >
            LANJUT
          </button>
        </div>
      </footer>
    </>
  );
}
