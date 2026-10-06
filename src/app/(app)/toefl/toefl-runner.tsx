"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, Timer, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ProgressRule } from "@/components/ui/ledger";
import {
  correctCount,
  SKILLS,
  underlineSpans,
  type ToeflQuestion,
} from "@/lib/toefl";
import { parseInline } from "@/lib/markdown";
import { DEFAULT_PREFS, speakLines, stopSpeaking, type VoicePrefs } from "@/lib/voices";
import { cn } from "@/lib/utils";

import { answerToefl, finishToefl } from "./actions";

export type ActiveSession = {
  id: number;
  section: string;
  label: string;
  passage: string | null;
  questions: ToeflQuestion[];
  answers: (number | null)[];
  completedAt: string | null;
  score: number | null;
};

const LETTERS = ["A", "B", "C", "D"];
const TYPE_LABEL: Record<string, string> = {
  structure: "Structure · lengkapi kalimat",
  written: "Error Recognition · pilih bagian yang salah",
  reading: "Reading",
  listening: "Listening",
};
const TEXT_SIZES = ["text-base", "text-lg", "text-xl", "text-2xl"];
const LOW_TIME_MS = 5 * 60_000;
const SPEAKER: Record<string, string> = {
  man: "Pria",
  woman: "Wanita",
  narrator: "Narator",
  speaker: "Pembicara",
};

function nextOpen(answers: (number | null)[], from: number) {
  const after = answers.findIndex((answer, i) => answer === null && i > from);
  if (after >= 0) return after;
  const any = answers.indexOf(null);
  return any >= 0 ? any : null;
}

function stopSpeech() {
  if (typeof window !== "undefined") stopSpeaking();
}

function speak(question: ToeflQuestion, prefs: VoicePrefs, questionOnly = false, onEnd?: () => void, onReady?: () => void) {
  const lines = questionOnly ? [] : (question.audio ?? []);
  speakLines([...lines, { speaker: "man", text: question.q }], prefs, onEnd, onReady);
}

/** Audio tanpa narator: identitas dialog/monolog, dipakai untuk deteksi audio bersama. */
function dialogueOf(question: ToeflQuestion | undefined) {
  const lines = (question?.audio ?? []).filter((line) => line.speaker !== "narrator");
  return lines.map((line) => `${line.speaker}:${line.text}`).join("\n");
}

/** Soal yang berbagi dialog (Long Dialogue, Lecture) memakai kunci dialog yang sama. */
function audioKeyOf(questions: ToeflQuestion[], index: number) {
  const key = dialogueOf(questions[index]);
  return questions.findIndex((question) => dialogueOf(question) === key);
}

function loadPlayed(sessionId: number): Set<number> {
  try {
    const raw = window.localStorage.getItem(`eprt-audio:${sessionId}`);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function savePlayed(sessionId: number, played: Set<number>) {
  try {
    window.localStorage.setItem(`eprt-audio:${sessionId}`, JSON.stringify([...played]));
  } catch {
    // Penyimpanan diblokir: batas sekali putar hanya berlaku sampai halaman dimuat ulang.
  }
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Sentence({ question, revealed }: { question: ToeflQuestion; revealed: boolean }) {
  if (question.type === "structure") {
    const [before, ...rest] = question.q.split(/_{2,}/);
    return (
      <>
        {before}
        {rest.length ? (
          revealed ? (
            <span className="font-semibold text-positive underline decoration-2 underline-offset-4">
              {question.options[question.answer]}
            </span>
          ) : (
            <span aria-label="bagian kosong" className="mx-1 inline-block w-16 border-b-2 border-ink" />
          )
        ) : null}
        {rest.join("___")}
      </>
    );
  }

  const spans = question.type === "written" ? underlineSpans(question.q, question.options) : null;
  if (!spans) {
    return (
      <>
        {parseInline(question.q).map((span, i) =>
          span.tone === "bold" ? (
            <strong key={i} className="rounded-md bg-highlight px-1.5">
              {span.text}
            </strong>
          ) : (
            span.text
          ),
        )}
      </>
    );
  }

  // Tanda baca di awal potongan (". " setelah bagian bergaris) menempel ke kata sebelumnya.
  const plain = (text: string, key: string) => (
    <span key={key} className={cn(/^[.,;:!?]/.test(text.trim()) && "-ml-3")}>
      {text.trim()}
    </span>
  );

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach(([start, end], index) => {
    const before = question.q.slice(cursor, start);
    if (before.trim()) nodes.push(plain(before, `t${index}`));
    const wrong = revealed && index === question.answer;
    nodes.push(
      <span key={index} className="inline-flex flex-col items-center gap-1.5">
        <span
          className={cn(
            "underline decoration-[3px] underline-offset-[8px]",
            wrong && "text-negative decoration-negative",
          )}
        >
          {question.q.slice(start, end)}
        </span>
        <span
          aria-hidden
          className={cn(
            "flex size-7 items-center justify-center rounded-lg font-mono text-[0.9375rem] font-semibold",
            wrong ? "bg-negative text-surface" : "bg-surface-sunken text-ink",
          )}
        >
          {LETTERS[index]}
        </span>
      </span>,
    );
    cursor = end;
  });
  const after = question.q.slice(cursor);
  if (after.trim()) nodes.push(plain(after, "end"));
  return <span className="flex flex-wrap items-start gap-x-3 gap-y-3">{nodes}</span>;
}

export function ToeflRunner({
  session,
  basePath = "/eptr",
  exam = false,
  timeLeftMs,
  voice = DEFAULT_PREFS,
}: {
  session: ActiveSession;
  basePath?: string;
  /** Mode ujian: kunci jawaban dan pembahasan disembunyikan, audio hanya sekali putar. */
  exam?: boolean;
  /** Sisa waktu section saat halaman dimuat; bagian ditutup otomatis saat habis. */
  timeLeftMs?: number;
  /** Suara Listening dari pengaturan admin. */
  voice?: VoicePrefs;
}) {
  const { questions } = session;
  const [answers, setAnswers] = useState(session.answers);
  const [index, setIndex] = useState<number | null>(() => nextOpen(session.answers, -1));
  const [error, setError] = useState<string | null>(null);
  const [silent, setSilent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [played, setPlayed] = useState<Set<number>>(() => new Set());
  const [finished, setFinished] = useState(Boolean(session.completedAt));
  const [deadline] = useState(() => (timeLeftMs === undefined ? null : Date.now() + timeLeftMs));
  const [left, setLeft] = useState(timeLeftMs ?? null);
  const expiredRef = useRef(false);
  // Pilihan yang belum dikirim: masih bisa diganti sampai Periksa/Lanjut ditekan.
  const [pending, setPending] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [textSize, setTextSize] = useState(0);
  const [offline, setOffline] = useState(false);
  const [announce, setAnnounce] = useState("");

  const announcedRef = useRef(false);
  // Jawaban yang gagal terkirim (misalnya sinyal putus) dicoba lagi saat online.
  const retryRef = useRef<{ index: number; choice: number }[]>([]);

  useEffect(() => {
    try {
      setHideTimer(window.localStorage.getItem("eprt-hide-timer") === "1");
      setTextSize(Number(window.localStorage.getItem("eprt-text-size")) || 0);
    } catch {
      // Preferensi tampilan saja; aman diabaikan.
    }
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      const queued = retryRef.current.splice(0);
      for (const item of queued) sendAnswer(item.index, item.choice);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
    // sendAnswer hanya memakai session.id yang tetap untuk halaman ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTimer() {
    setHideTimer((value) => {
      try {
        window.localStorage.setItem("eprt-hide-timer", value ? "0" : "1");
      } catch {
        // abaikan
      }
      return !value;
    });
  }

  function changeTextSize(step: number) {
    setTextSize((value) => {
      const nextSize = Math.min(Math.max(value + step, 0), TEXT_SIZES.length - 1);
      try {
        window.localStorage.setItem("eprt-text-size", String(nextSize));
      } catch {
        // abaikan
      }
      return nextSize;
    });
  }

  function say(target: ToeflQuestion, questionOnly = false) {
    setSpeaking(true);
    setLoadingAudio(true);
    speak(target, voice, questionOnly, () => setSpeaking(false), () => setLoadingAudio(false));
  }

  function silence() {
    stopSpeech();
    setSpeaking(false);
    setLoadingAudio(false);
  }

  useEffect(() => {
    if (exam) setPlayed(loadPlayed(session.id));
  }, [exam, session.id]);

  // Audio tidak boleh terus berbunyi setelah keluar dari halaman soal.
  useEffect(() => stopSpeech, []);

  const complete = !answers.includes(null);
  const question = index === null ? null : questions[index];
  const chosen = index === null ? null : answers[index];
  const revealed = chosen !== null && !exam;
  const audioKey = index === null ? -1 : audioKeyOf(questions, index);
  const audioUsed = exam && played.has(audioKey);

  function sendAnswer(answerIndex: number, choice: number) {
    answerToefl(session.id, answerIndex, choice)
      .then((result) => {
        if (result.status === "error") setError(result.message ?? "Jawaban gagal disimpan.");
      })
      .catch(() => {
        retryRef.current.push({ index: answerIndex, choice });
        setError(
          navigator.onLine
            ? "Jawaban gagal dikirim. Akan dicoba lagi saat koneksi stabil."
            : "Belum tersimpan karena offline. Dikirim otomatis saat tersambung lagi.",
        );
      });
  }

  function choose(option: number) {
    if (index === null || answers[index] !== null) return;
    setPending(option);
    setError(null);
  }

  /** Kunci pilihan yang sedang dipilih dan kirim ke server. */
  function commit() {
    if (index === null || pending === null || answers[index] !== null) return answers;
    const updated = answers.map((answer, i) => (i === index ? pending : answer));
    setAnswers(updated);
    setPending(null);
    sendAnswer(index, pending);
    return updated;
  }
  const commitRef = useRef(commit);
  commitRef.current = commit;

  function markPlayed(key: number) {
    setPlayed((prev) => {
      const nextSet = new Set(prev).add(key);
      savePlayed(session.id, nextSet);
      return nextSet;
    });
  }

  function next() {
    if (index === null) return;
    // Hentikan audio soal sebelumnya, termasuk sisa antrean kalau jawabnya cepat.
    silence();
    const current = commit();
    const target = nextOpen(current, index);
    setIndex(target);
    // Mode ujian: audio soal berikutnya langsung diputar seperti tes asli. Dialog
    // yang sudah didengar tidak diulang, hanya pertanyaan naratornya.
    const upcoming = target === null ? null : questions[target];
    if (!exam || target === null || !upcoming?.audio || !("speechSynthesis" in window)) return;
    const key = audioKeyOf(questions, target);
    const heard = played.has(key);
    if (!heard) markPlayed(key);
    say(upcoming, heard);
  }

  function play() {
    if (!question?.audio) return;
    if (!("speechSynthesis" in window)) {
      setSilent(true);
      return;
    }
    if (audioUsed) {
      say(question, true);
      return;
    }
    if (exam) markPlayed(audioKey);
    say(question);
  }

  function finish() {
    silence();
    setPending(null);
    setBusy(true);
    setAnswers((prev) => prev.map((answer) => answer ?? -1));
    setIndex(null);
    finishToefl(session.id)
      .then((result) => {
        if (result.status === "error") setError(result.message ?? "Gagal menyelesaikan sesi.");
        else setFinished(true);
      })
      .catch(() => setError("Gagal menyelesaikan sesi. Periksa koneksi."))
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    if (deadline === null || finished) return;
    const tick = () => {
      const remaining = deadline - Date.now();
      setLeft(remaining);
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setError("Waktu section habis. Soal yang belum dijawab dihitung salah.");
        // Pilihan yang sudah diklik tapi belum dikirim tetap dihitung.
        commitRef.current();
        finish();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // finish() hanya dipanggil sekali lewat expiredRef; tidak perlu jadi dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, finished]);

  const lowTime = left !== null && left <= LOW_TIME_MS;
  const timerVisible = !hideTimer || lowTime;
  const answeredCount = answers.filter((answer) => answer !== null).length;

  useEffect(() => {
    if (lowTime && !announcedRef.current && !finished) {
      announcedRef.current = true;
      setAnnounce("Perhatian: sisa waktu section 5 menit.");
    }
  }, [lowTime, finished]);

  // ---------------------------------------------------------------------------
  // Tampilan

  const header = (
    <div className="sticky top-14 z-20 -mx-4 lg:top-4 border-b border-hairline bg-surface sm:mx-0 sm:rounded-plate sm:border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href={basePath}
          className="flex h-11 items-center gap-2 rounded-control border-[1.5px] border-hairline-strong px-3.5 text-[0.9375rem] font-semibold text-ink hover:border-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Simpan &amp; keluar
        </Link>
        <div className="order-last flex min-w-0 basis-full flex-col sm:order-none sm:basis-auto sm:flex-1">
          <span className="eyebrow text-ink-subtle">{exam ? "Simulasi · mode ujian" : "Latihan"}</span>
          <span className="truncate text-[1.0625rem] font-bold">{session.label}</span>
        </div>
        {index !== null ? (
          <span className="tnum ml-auto font-mono text-[0.9375rem] font-semibold text-ink-subtle sm:ml-0">
            Soal {index + 1} / {questions.length}
          </span>
        ) : null}
        {left !== null && !finished ? (
          <div className="flex items-center gap-2">
            {timerVisible ? (
              <span
                role="timer"
                aria-label={`Sisa waktu ${formatClock(left)}`}
                className={cn(
                  "tnum flex h-11 items-center gap-2 rounded-control px-3.5 font-mono text-[1.0625rem] font-semibold",
                  lowTime ? "bg-warning text-surface" : "bg-night text-night-ink",
                )}
              >
                <Timer className="size-4" aria-hidden />
                {formatClock(left)}
              </span>
            ) : null}
            {!lowTime ? (
              <button
                type="button"
                aria-pressed={hideTimer}
                onClick={toggleTimer}
                className="h-11 rounded-control border-[1.5px] border-hairline-strong px-3 text-[0.875rem] font-semibold hover:border-ink"
              >
                {hideTimer ? "Tampilkan timer" : "Sembunyikan timer"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-label={`${answeredCount} dari ${questions.length} soal dijawab`}
        aria-valuenow={Math.round((answeredCount / Math.max(1, questions.length)) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 bg-surface-sunken sm:mx-6 sm:mb-3 sm:rounded-full"
      >
        <div
          className="h-full bg-accent transition-[width] duration-300 sm:rounded-full"
          style={{ width: `${(answeredCount / Math.max(1, questions.length)) * 100}%` }}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {offline ? (
        <p role="status" className="border-t border-hairline bg-warning-soft px-4 py-2 text-[0.9375rem] font-semibold text-warning-ink sm:px-6">
          Kamu sedang offline. Jawaban disimpan sementara dan dikirim otomatis saat tersambung lagi.
        </p>
      ) : null}
    </div>
  );

  if ((!question || index === null) && exam) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <section className="page-enter flex flex-col gap-4 rounded-plate border-2 border-hairline bg-surface p-6 sm:p-8">
          <h1 className="font-display text-[2rem] font-extrabold">Bagian selesai</h1>
          <p className="max-w-xl text-[1.0625rem] leading-relaxed text-ink-subtle">
            Skor dan pembahasan muncul setelah semua bagian simulasi selesai.
          </p>
          {error ? (
            <p role="alert" className="text-[0.9375rem] font-semibold text-negative">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            {finished ? (
              <Link href={basePath} className={cn(buttonVariants(), "h-14 px-7 text-lg")}>
                Lanjut ke bagian berikutnya
                <ArrowRight className="size-5" aria-hidden />
              </Link>
            ) : (
              <Button onClick={finish} disabled={busy} className="h-14 px-7 text-lg">
                {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                Simpan bagian ini
              </Button>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (!question || index === null) {
    const correct = correctCount(questions, answers);
    const bySkill = new Map<string, { correct: number; total: number }>();
    questions.forEach((item, i) => {
      const label = item.skill ? SKILLS[item.skill].label : "Lainnya";
      const entry = bySkill.get(label) ?? { correct: 0, total: 0 };
      bySkill.set(label, {
        correct: entry.correct + (answers[i] === item.answer ? 1 : 0),
        total: entry.total + 1,
      });
    });
    const pct = questions.length ? Math.round((correct / questions.length) * 100) : 0;

    return (
      <div className="flex flex-col gap-6">
        {header}
        <section className="page-enter flex flex-col gap-6 rounded-plate border-2 border-hairline bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-[1.0625rem] font-bold text-ink-subtle">Hasil latihan</span>
              <p className="tnum font-display text-[4rem] font-extrabold leading-none tracking-[-0.03em]">
                {correct}
                <span className="text-ink-faint">/{questions.length}</span>
              </p>
              <span className="text-[1.0625rem] text-ink-subtle">jawaban benar</span>
            </div>
            <div className="flex gap-8">
              {session.score !== null ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[0.9375rem] font-semibold text-ink-subtle">Skor bagian</span>
                  <span className="tnum font-display text-[2.25rem] font-extrabold">{session.score}</span>
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <span className="text-[0.9375rem] font-semibold text-ink-subtle">Akurasi</span>
                <span className="tnum font-display text-[2.25rem] font-extrabold text-accent">{pct}%</span>
              </div>
            </div>
          </div>

          <ProgressRule value={pct} tone={pct >= 75 ? "success" : pct >= 50 ? "accent" : "danger"} className="h-3" />

          <ul className="flex flex-col gap-2">
            {[...bySkill].map(([label, entry]) => {
              const weak = entry.correct * 2 < entry.total;
              return (
                <li key={label} className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-4 py-3">
                  <span className="text-base font-semibold">{label}</span>
                  <span className="flex items-center gap-3">
                    <span className="tnum font-mono text-[0.9375rem]">
                      {entry.correct}/{entry.total}
                    </span>
                    <span className={cn("text-[0.875rem] font-bold", weak ? "text-warning-ink" : "text-accent-ink")}>
                      {weak ? "Perlu latihan" : "Cukup"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex justify-end">
            <Link href={basePath} className={cn(buttonVariants(), "h-14 px-7 text-lg")}>
              Kembali ke EPrT
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const right = chosen === question.answer;
  const selected = chosen ?? pending;
  const lastOpen = chosen === null && answers.filter((answer) => answer === null).length === 1;
  const last = answers.every((answer, i) => answer !== null || i === index);
  const isListening = Boolean(question.audio);
  const isWritten = question.type === "written";

  const optionGrid = isWritten
    ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    : isListening
      ? "flex flex-col gap-3"
      : "grid gap-3 sm:grid-cols-2";

  const options = (
    <div role="radiogroup" aria-labelledby="question-text" className={optionGrid}>
      {question.options.map((option, i) => {
        const isAnswer = i === question.answer;
        const isWrongPick = chosen === i && !right;
        const isSelected = selected === i;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={chosen !== null}
            onClick={() => choose(i)}
            className={cn(
              "flex min-h-16 items-center gap-4 rounded-[16px] px-4 py-3 text-left text-[1.0625rem] transition-colors sm:text-lg",
              !revealed && !isSelected && "cursor-pointer border-2 border-hairline bg-surface text-ink hover:border-primary/50",
              !revealed && isSelected && "border-2 border-primary bg-primary-soft font-semibold text-primary-deep",
              revealed && isAnswer && "border-2 border-positive bg-positive-soft font-bold text-accent-ink",
              revealed && isWrongPick && "border-2 border-dashed border-negative bg-negative-soft font-bold text-[#7e1d1d]",
              revealed && !isAnswer && !isWrongPick && "border-[1.5px] border-hairline bg-surface text-ink-faint",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-[10px] font-mono text-base font-semibold",
                !revealed && isSelected ? "bg-primary text-white" : "bg-surface-muted text-ink",
                revealed && (isAnswer || isWrongPick) && "bg-transparent",
              )}
            >
              {revealed && isAnswer ? (
                <Check className="size-5" strokeWidth={2.5} />
              ) : revealed && isWrongPick ? (
                <X className="size-5" strokeWidth={2.5} />
              ) : (
                LETTERS[i]
              )}
            </span>
            <span className="min-w-0">{option}</span>
          </button>
        );
      })}
    </div>
  );

  const actionBar = (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-hairline bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0">
      <p className="text-center text-[0.9375rem] text-ink-subtle sm:text-left">
        {pending !== null
          ? exam
            ? "Pilihan masih bisa diganti sebelum lanjut."
            : "Pilihan masih bisa diganti sebelum diperiksa."
          : complete
            ? "Semua soal sudah dijawab."
            : "Pilih salah satu jawaban."}
      </p>
      {pending !== null ? (
        !exam ? (
          <Button onClick={() => commit()} className="h-14 px-7 text-lg">
            Periksa jawaban
          </Button>
        ) : lastOpen ? (
          <Button
            onClick={() => {
              commit();
              finish();
            }}
            disabled={busy}
            className="h-14 px-7 text-lg"
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            Selesai
          </Button>
        ) : (
          <Button onClick={next} className="h-14 px-7 text-lg">
            Lanjut
            <ArrowRight className="size-5" aria-hidden />
          </Button>
        )
      ) : complete && !revealed ? (
        <Button onClick={finish} disabled={busy} className="h-14 px-7 text-lg">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          Selesai
        </Button>
      ) : null}
    </div>
  );

  const feedback = revealed ? (
    <div role="status" className="page-enter flex flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.9375rem] font-bold",
            right ? "bg-positive-soft text-accent-ink" : "bg-negative-soft text-[#7e1d1d]",
          )}
        >
          {right ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <X className="size-4" strokeWidth={3} aria-hidden />}
          {right ? "Benar" : "Belum tepat"}
        </span>
        {!right ? (
          <span className="text-base">
            Jawaban benar: <strong>{LETTERS[question.answer]}. {question.options[question.answer]}</strong>
          </span>
        ) : null}
      </div>
      {question.explain_id ? (
        <p className="text-[1.0625rem] leading-relaxed text-ink-muted">{question.explain_id}</p>
      ) : null}
      {question.audio ? (
        <details className="rounded-control bg-surface-muted px-4 py-3">
          <summary className="cursor-pointer text-[0.9375rem] font-semibold">Lihat transkrip</summary>
          <div className="mt-2 flex flex-col gap-1 text-base leading-relaxed">
            {question.audio.map((line, i) => (
              <p key={i}>
                <span className="font-bold">{SPEAKER[line.speaker]}:</span> {line.text}
              </p>
            ))}
          </div>
        </details>
      ) : null}
      {question.skill ? <p className="eyebrow text-ink-subtle">Skill · {SKILLS[question.skill].label}</p> : null}
      {error ? (
        <p role="alert" className="text-[0.9375rem] font-semibold text-negative">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button autoFocus onClick={next} disabled={busy} className="h-14 px-7 text-lg">
          {last ? "Lihat hasil" : "Soal berikutnya"}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>
    </div>
  ) : null;

  const questionHeading = (
    <h1
      id="question-text"
      className={cn(
        "font-display font-semibold leading-snug",
        isWritten || question.type === "structure"
          ? "text-[1.625rem] sm:text-[2.25rem]"
          : "text-[1.5rem] sm:text-[1.875rem]",
      )}
    >
      {isListening ? question.q : <Sentence question={question} revealed={revealed} />}
    </h1>
  );

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div
        key={index}
        className={cn(
          "page-enter grid gap-6 lg:gap-10",
          (isListening || session.passage) && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]",
        )}
      >
        {isListening ? (
          <section
            aria-label="Audio"
            className="flex flex-col justify-between gap-4 rounded-[24px] bg-night p-4 text-night-ink sm:gap-6 sm:rounded-[28px] sm:p-8 lg:min-h-[480px]"
          >
            <div className="hidden flex-col gap-2 sm:flex">
              <span className="eyebrow text-[#bfe3cf]">{TYPE_LABEL.listening}</span>
              <p className="text-[1.0625rem] leading-relaxed text-night-muted">
                {exam
                  ? "Dengarkan percakapan, lalu narator membacakan pertanyaan."
                  : "Putar audio, dengarkan, lalu pilih jawaban."}
              </p>
            </div>
            <div aria-hidden className={cn("h-28 items-center justify-center gap-1.5", speaking ? "flex" : "hidden sm:flex")}>
              {[60, 100, 130, 80, 110, 70, 120, 50, 90].map((height, i) => (
                <span
                  key={i}
                  className={cn("w-2 rounded bg-mint", speaking && !loadingAudio ? "wave-bar" : "opacity-40")}
                  style={{ height: speaking && !loadingAudio ? height : 16, animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {speaking ? (
                <p role="status" className="flex h-14 items-center justify-center gap-2.5 rounded-[16px] bg-night-raised text-lg font-bold">
                  {loadingAudio ? (
                    <Loader2 className="size-5 animate-spin text-mint" aria-hidden />
                  ) : (
                    <Volume2 className="size-5 text-mint" aria-hidden />
                  )}
                  {loadingAudio ? "Memuat audio…" : "Sedang diputar"}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={play}
                  className="flex h-14 items-center justify-center gap-2.5 rounded-[16px] bg-night-ink text-lg font-bold text-ink hover:bg-white"
                >
                  <Volume2 className="size-5" aria-hidden />
                  {audioUsed ? "Dengar pertanyaan lagi" : "Putar audio"}
                </button>
              )}
              <p className="text-center text-[0.9375rem] text-night-muted">
                {silent
                  ? "Browser tanpa suara. Transkrip ditampilkan."
                  : exam
                    ? audioUsed
                      ? "Dialog sudah diputar. Pertanyaan bisa didengar ulang."
                      : "Audio hanya diputar sekali, seperti tes asli."
                    : "Transkrip muncul setelah jawaban diperiksa."}
              </p>
            </div>
            {silent ? (
              <div className="flex flex-col gap-1 rounded-control bg-night-raised p-4 text-base leading-relaxed">
                {question.audio?.map((line, i) => (
                  <p key={i}>
                    <span className="font-bold">{SPEAKER[line.speaker]}:</span> {line.text}
                  </p>
                ))}
              </div>
            ) : null}
          </section>
        ) : session.passage ? (
          <article
            aria-label="Teks bacaan"
            className="flex flex-col gap-4 self-start rounded-plate border-2 border-hairline bg-surface p-5 sm:p-8 lg:sticky lg:top-44"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow text-ink-subtle">Teks bacaan</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  aria-label="Perkecil teks bacaan"
                  disabled={textSize === 0}
                  onClick={() => changeTextSize(-1)}
                  className="size-11 rounded-[10px] border-[1.5px] border-hairline-strong text-[0.9375rem] font-bold disabled:opacity-40"
                >
                  A−
                </button>
                <button
                  type="button"
                  aria-label="Perbesar teks bacaan"
                  disabled={textSize === TEXT_SIZES.length - 1}
                  onClick={() => changeTextSize(1)}
                  className="size-11 rounded-[10px] border-[1.5px] border-hairline-strong text-lg font-bold disabled:opacity-40"
                >
                  A+
                </button>
              </div>
            </div>
            <div className={cn("flex max-h-[62dvh] max-w-[64ch] flex-col gap-4 overflow-y-auto leading-[1.75]", TEXT_SIZES[textSize])}>
              {session.passage
                .split(/\n\s*\n/)
                .filter((paragraph) => paragraph.trim())
                .map((paragraph, i) => (
                  <p key={i}>
                    <span className="mr-2.5 font-mono text-[0.9375rem] font-semibold text-ink-subtle">{i + 1}</span>
                    {parseInline(paragraph.trim()).map((span, j) =>
                      span.tone === "bold" ? (
                        <strong key={j} className="rounded bg-highlight px-1">
                          {span.text}
                        </strong>
                      ) : (
                        span.text
                      ),
                    )}
                  </p>
                ))}
            </div>
          </article>
        ) : null}

        <section className={cn("flex flex-col gap-6", !isListening && !session.passage && "mx-auto w-full max-w-5xl")}>
          <div className="flex flex-col gap-3">
            <span className="eyebrow text-ink-subtle">
              {isListening ? "Pertanyaan narator" : (TYPE_LABEL[question.type] ?? "Soal")}
            </span>
            {questionHeading}
          </div>
          {options}
          {feedback}
          {!revealed ? actionBar : null}
          {!revealed && error ? (
            <p role="alert" className="text-[0.9375rem] font-semibold text-negative">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
