"use client";

import { ArrowRight, Check, GraduationCap, Loader2, Pause, Timer, Volume2, X } from "lucide-react";
import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { Kaka } from "@/components/mascot";
import { Anatomy, blankAnatomy } from "@/components/ui/anatomy";
import { SkillChip } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  correctCount,
  SKILLS,
  underlineSpans,
  type SkillKey,
  type ToeflQuestion,
} from "@/lib/toefl";
import { parseInline } from "@/lib/markdown";
import {
  DEFAULT_PREFS,
  speakLines,
  stopSpeaking,
  type VoicePrefs,
} from "@/lib/voices";
import { cn } from "@/lib/utils";

import { answerToefl, finishToefl, startToeflBlock } from "./actions";
import { AskAi } from "./ask-ai";

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

function speak(
  question: ToeflQuestion,
  prefs: VoicePrefs,
  questionOnly = false,
  onEnd?: () => void,
  onReady?: () => void,
) {
  const lines = questionOnly ? [] : (question.audio ?? []);
  speakLines(
    [...lines, { speaker: "man", text: question.q }],
    prefs,
    onEnd,
    onReady,
  );
}

/** Audio tanpa narator: identitas dialog/monolog, dipakai untuk deteksi audio bersama. */
function dialogueOf(question: ToeflQuestion | undefined) {
  const lines = (question?.audio ?? []).filter(
    (line) => line.speaker !== "narrator",
  );
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
    window.localStorage.setItem(
      `eprt-audio:${sessionId}`,
      JSON.stringify([...played]),
    );
  } catch {
    // Penyimpanan diblokir: batas sekali putar hanya berlaku sampai halaman dimuat ulang.
  }
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function Sentence({
  question,
  revealed,
}: {
  question: ToeflQuestion;
  revealed: boolean;
}) {
  if (question.type === "structure") {
    const [before, ...rest] = question.q.split(/_{2,}/);
    return (
      <>
        {before}
        {rest.length ? (
          revealed ? (
            <span className="rounded-[8px] border-b-4 border-primary bg-primary-soft px-1.5 font-bold text-primary-deep">
              {question.options[question.answer]}
            </span>
          ) : (
            <span
              aria-label="bagian kosong"
              className="mx-1 inline-block w-24 border-b-[3px] border-ink"
            />
          )
        ) : null}
        {rest.join("___")}
      </>
    );
  }

  const spans =
    question.type === "written"
      ? underlineSpans(question.q, question.options)
      : null;
  if (!spans) {
    return (
      <>
        {parseInline(question.q).map((span, i) =>
          span.tone === "bold" ? (
            <strong key={i} className="rounded-md bg-sky-soft px-1.5 text-sky-deep">
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
            "border-b-[3px] border-hairline-strong px-0.5",
            wrong && "rounded-[6px] border-brick bg-brick-soft text-brick-deep",
          )}
        >
          {question.q.slice(start, end)}
        </span>
        <span
          aria-hidden
          className={cn(
            "flex size-6 items-center justify-center rounded-[6px] text-[0.75rem] font-extrabold",
            wrong ? "bg-brick text-white" : "bg-canvas text-ink-subtle",
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
  return (
    <span className="flex flex-wrap items-start gap-x-3 gap-y-3">{nodes}</span>
  );
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
  const [index, setIndex] = useState<number | null>(() =>
    nextOpen(session.answers, -1),
  );
  const [error, setError] = useState<string | null>(null);
  const [silent, setSilent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [played, setPlayed] = useState<Set<number>>(() => new Set());
  const [finished, setFinished] = useState(Boolean(session.completedAt));
  const [deadline] = useState(() =>
    timeLeftMs === undefined ? null : Date.now() + timeLeftMs,
  );
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
  // Tombol "Latihan ulang" di halaman hasil: mulai latihan baru via server action.
  const [repeatState, repeatAction, repeatPending] = useActionState(startToeflBlock, {
    status: "idle",
  });

  const announcedRef = useRef(false);
  // Jawaban yang gagal terkirim (misalnya sinyal putus) dicoba lagi saat online.
  const retryRef = useRef<{ index: number; choice: number }[]>([]);
  // Kiriman jawaban yang masih jalan. finish() menunggu semuanya sebelum
  // menutup sesi, supaya jawaban terakhir tidak kalah lomba dengan finishToefl
  // (server menolak jawaban yang datang setelah sesi ditutup).
  const inflightRef = useRef<Set<Promise<void>>>(new Set());

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
      const nextSize = Math.min(
        Math.max(value + step, 0),
        TEXT_SIZES.length - 1,
      );
      try {
        window.localStorage.setItem("eprt-text-size", String(nextSize));
      } catch {
        // abaikan
      }
      return nextSize;
    });
  }

  /** Putaran audio terbaru; callback putaran lama (dipotong) diabaikan. */
  const sayRef = useRef(0);

  /** `markKey`: dialog baru dihitung "sudah diputar" kalau selesai didengar, bukan saat mulai
   *  (soal berbagi dialog yang dilewati cepat tidak boleh kehilangan dialognya). */
  function say(target: ToeflQuestion, questionOnly = false, markKey?: number) {
    const id = ++sayRef.current;
    setSpeaking(true);
    setLoadingAudio(true);
    speak(
      target,
      voice,
      questionOnly,
      () => {
        if (id !== sayRef.current) return;
        setSpeaking(false);
        if (markKey !== undefined) markPlayed(markKey);
      },
      () => setLoadingAudio(false),
    );
  }

  function silence() {
    sayRef.current += 1;
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
    const sent = answerToefl(session.id, answerIndex, choice)
      .then((result) => {
        if (result.status === "error")
          setError(result.message ?? "Jawaban gagal disimpan.");
        else {
          // Sukses: pesan kegagalan kiriman sebelumnya tidak lagi relevan
          // (jangan hapus pesan lain seperti "Waktu section habis").
          setError((prev) => (prev && /Jawaban gagal|Belum tersimpan/.test(prev) ? null : prev));
          // Retry lama untuk slot yang baru berhasil tidak boleh dikirim ulang:
          // jawaban boleh dikoreksi di mode ujian, retry basi bisa menimpanya.
          retryRef.current = retryRef.current.filter((item) => item.index !== answerIndex);
          // Antrean gagal sebelumnya dikirim ulang sekarang juga — kegagalan
          // bisa terjadi walau browser online, tidak harus menunggu event online.
          const queued = retryRef.current.splice(0);
          for (const item of queued) sendAnswer(item.index, item.choice);
        }
      })
      .catch(() => {
        retryRef.current.push({ index: answerIndex, choice });
        setError(
          navigator.onLine
            ? "Jawaban gagal dikirim. Akan dicoba lagi saat koneksi stabil."
            : "Belum tersimpan karena offline. Dikirim otomatis saat tersambung lagi.",
        );
      });
    inflightRef.current.add(sent);
    void sent.finally(() => inflightRef.current.delete(sent));
  }

  function choose(option: number) {
    if (index === null) return;
    // Mode ujian non-audio: soal terjawab boleh dipilih ulang (koreksi jawaban).
    if (answers[index] !== null && !canRevisit) return;
    setPending(option);
    setError(null);
  }

  /** Kunci pilihan yang sedang dipilih dan kirim ke server. */
  function commit() {
    if (index === null || pending === null) return answers;
    if (answers[index] !== null && !canRevisit) return answers;
    const updated = answers.map((answer, i) =>
      i === index ? pending : answer,
    );
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
    if (
      !exam ||
      target === null ||
      !upcoming?.audio ||
      !("speechSynthesis" in window)
    )
      return;
    const key = audioKeyOf(questions, target);
    const heard = played.has(key);
    say(upcoming, heard, heard ? undefined : key);
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
    say(question, false, exam ? audioKey : undefined);
  }

  async function finish() {
    silence();
    setPending(null);
    setAnswers((prev) => prev.map((answer) => answer ?? -1));
    setIndex(null);
    setBusy(true);
    // Tunggu kiriman jawaban yang masih jalan (misalnya pilihan terakhir
    // saat waktu habis) sebelum menutup sesi di server.
    await Promise.allSettled([...inflightRef.current]);
    try {
      const result = await finishToefl(session.id);
      if (result.status === "error")
        setError(result.message ?? "Gagal menyelesaikan sesi.");
      else setFinished(true);
    } catch {
      setError("Gagal menyelesaikan sesi. Periksa koneksi.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (deadline === null || finished) return;
    const tick = () => {
      const remaining = deadline - Date.now();
      setLeft(remaining);
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setError(
          "Waktu section habis. Soal yang belum dijawab dihitung salah.",
        );
        // Pilihan yang sudah diklik tapi belum dikirim tetap dihitung:
        // commit mengirimnya, finish menunggu kiriman selesai sebelum menutup sesi.
        commitRef.current();
        void finish();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // finish() hanya dipanggil sekali lewat expiredRef; tidak perlu jadi dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, finished]);

  // Timer section jalan di server; peringatkan sebelum tab ditutup selagi waktu masih berjalan.
  useEffect(() => {
    if (deadline === null || finished) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [deadline, finished]);

  const lowTime = left !== null && left <= LOW_TIME_MS;
  const timerVisible = !hideTimer || lowTime;
  // finish() menandai soal yang tak dijawab dengan -1; angka itu bukan jawaban.
  const answeredCount = answers.filter((answer) => answer !== null && answer !== -1).length;

  useEffect(() => {
    if (lowTime && !announcedRef.current && !finished) {
      announcedRef.current = true;
      setAnnounce("Perhatian: sisa waktu section 5 menit.");
    }
  }, [lowTime, finished]);

  // ---------------------------------------------------------------------------
  // Tampilan

  const audioSession = questions.some((item) => Boolean(item.audio));
  // Mode ujian tanpa audio: soal terjawab boleh dikunjungi ulang untuk dikoreksi.
  // Sesuai audio tetap terkunci (urutan putar harus terjaga) dan mode latihan
  // tetap seperti semula (jawaban langsung diperiksa saat diperiksa).
  const canRevisit = exam && !audioSession;

  /** Lompat ke soal lain (bukan untuk sesi audio: urutan putar harus terjaga).
   *  Mode ujian non-audio: soal terjawab juga bisa dipilih untuk dikoreksi. */
  function jump(target: number) {
    if (audioSession || target === index) return;
    if (!canRevisit && answers[target] !== null) return;
    silence();
    commit();
    setIndex(target);
  }

  const header = (trigger?: React.ReactNode) => (
    <header className="sticky top-0 z-30 bg-charcoal pt-[env(safe-area-inset-top)] text-charcoal-ink">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 text-[0.8125rem] font-extrabold tracking-[0.06em] text-charcoal-muted">
          <GraduationCap className="size-[18px] text-mango" strokeWidth={2.2} aria-hidden />
          {exam ? "SIMULASI · MODE UJIAN" : "LATIHAN EPrT"}
        </span>
        <span className="hidden h-6 w-0.5 bg-charcoal-line sm:block" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-display text-[1rem] font-extrabold">{session.label}</span>
        {index !== null ? (
          <span className="tnum text-[0.875rem] font-bold text-charcoal-muted">
            Soal {index + 1} dari {questions.length}
          </span>
        ) : null}
        {left !== null && !finished ? (
          <div className="flex items-center gap-2">
            {timerVisible ? (
              <span
                role="timer"
                aria-label={`Sisa waktu ${formatClock(left)}`}
                className={cn(
                  "tnum flex h-10 items-center gap-1.5 rounded-[12px] px-3.5 font-round text-[1.25rem] font-extrabold",
                  lowTime ? "bg-brick text-white" : "bg-mango text-mango-on",
                )}
              >
                <Timer className="size-[18px]" strokeWidth={2.6} aria-hidden />
                {formatClock(left)}
              </span>
            ) : null}
            {!lowTime ? (
              <button
                type="button"
                aria-pressed={hideTimer}
                onClick={toggleTimer}
                className="h-10 cursor-pointer rounded-[12px] border-2 border-charcoal-line px-3 text-[0.8125rem] font-bold hover:bg-charcoal-raised"
              >
                {hideTimer ? "Tampilkan timer" : "Sembunyikan timer"}
              </button>
            ) : null}
          </div>
        ) : null}
        {trigger}
        <Link
          href={basePath}
          aria-label="Simpan dan keluar"
          title="Simpan & keluar"
          onClick={(event) => {
            // Timer section jalan di server walau browser ditutup; pastikan keluar
            // memang disengaja selagi waktu masih berjalan.
            if (
              deadline !== null &&
              !finished &&
              !window.confirm("Timer section tetap berjalan walau keluar. Keluar sekarang?")
            ) {
              event.preventDefault();
            }
          }}
          className="flex h-10 items-center gap-1.5 rounded-[12px] border-2 border-charcoal-line px-3 text-[0.8125rem] font-bold hover:bg-charcoal-raised"
        >
          <Pause className="size-4" aria-hidden />
          <span className="hidden sm:inline">Simpan &amp; keluar</span>
        </Link>
      </div>
      <div
        role="progressbar"
        aria-label={`${answeredCount} dari ${questions.length} soal dijawab`}
        aria-valuenow={Math.round((answeredCount / Math.max(1, questions.length)) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 bg-charcoal-raised"
      >
        <div
          className="h-full w-full origin-left bg-mango transition-transform duration-300 ease-[var(--ease-out)]"
          style={{ transform: `scaleX(${answeredCount / Math.max(1, questions.length)})` }}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {offline ? (
        <p role="status" className="bg-mango-soft px-4 py-2 text-center text-[0.875rem] font-bold text-mango-ink">
          Kamu sedang offline. Jawaban disimpan sementara dan dikirim otomatis saat tersambung lagi.
        </p>
      ) : null}
    </header>
  );

  const shell = (children: React.ReactNode, trigger?: React.ReactNode) => (
    <div className="flex min-h-screen flex-col bg-canvas">
      {header(trigger)}
      {children}
    </div>
  );

  if ((!question || index === null) && exam) {
    return shell(
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="page-enter flex w-full max-w-[560px] flex-col items-center gap-4 rounded-hero border-2 border-hairline bg-surface p-8 text-center shadow-card">
          <Kaka mood={finished ? "proud" : "coach"} size={140} label="Kaka" />
          <h1 className="font-display text-[2rem] font-black">Bagian selesai</h1>
          <p className="max-w-md text-[1rem] leading-relaxed text-ink-subtle">
            {answeredCount} dari {questions.length} soal dijawab. Skor dan pembahasan muncul setelah semua bagian simulasi selesai.
          </p>
          {error ? (
            <p role="alert" className="text-[0.9375rem] font-bold text-brick-deep">
              {error}
            </p>
          ) : null}
          {finished ? (
            <Link href={basePath} className={buttonVariants({ variant: "exam", size: "lg" })}>
              Lanjut ke bagian berikutnya
              <ArrowRight className="size-5" aria-hidden />
            </Link>
          ) : (
            <Button variant="exam" size="lg" onClick={finish} disabled={busy}>
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              Simpan bagian ini
            </Button>
          )}
        </section>
      </main>,
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
    // Urutan soal salah/tidak dijawab, untuk pembahasan di bawah rekap.
    const wrong = questions
      .map((item, i) => ({ item, i, answer: answers[i] }))
      .filter(({ item, answer }) => answer !== item.answer);

    // Tombol "Latihan ulang": jenis latihan sama dengan sesi ini.
    const repeatKind = (() => {
      if (session.section === "review") return "review";
      if (session.section === "reading") return "reading";
      if (session.section === "listening") {
        const skill = questions[0]?.skill;
        if (skill === "listen-long") return "listen-long";
        if (skill === "listen-lecture") return "listen-lecture";
        return questions.length > 10 ? "listening-15" : "listening";
      }
      return questions[0]?.type === "written" ? "written" : "drill";
    })();
    // Fokus ke topik terlemah sesi ini (akurasi < 50%) kalau ada.
    const repeatSkill = (() => {
      if (session.section !== "structure" && session.section !== "reading") return null;
      const tally = new Map<SkillKey, { correct: number; total: number }>();
      questions.forEach((item, i) => {
        if (!item.skill) return;
        const entry = tally.get(item.skill) ?? { correct: 0, total: 0 };
        entry.total += 1;
        if (answers[i] === item.answer) entry.correct += 1;
        tally.set(item.skill, entry);
      });
      return (
        [...tally.entries()]
          .filter(([, entry]) => entry.correct * 2 < entry.total)
          .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)[0]?.[0] ?? null
      );
    })();

    return shell(
      <main className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 py-8 sm:px-6">
        <section className="page-enter flex flex-wrap items-center gap-8 rounded-[32px] bg-charcoal p-6 text-charcoal-ink sm:p-8">
          <Kaka mood={pct >= 70 ? "proud" : "warn"} size={150} label="Kaka melihat hasilmu" className="shrink-0" />
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
            <span className="eyebrow text-mango-line">Hasil latihan</span>
            <span className="flex flex-wrap items-baseline gap-3">
              <span className="tnum font-round text-[4.5rem] font-extrabold leading-[0.9]">
                {correct}
                <span className="text-charcoal-muted">/{questions.length}</span>
              </span>
              <span className="rounded-full bg-charcoal-raised px-3 py-1 text-[0.9375rem] font-extrabold text-mint">{pct}% benar</span>
            </span>
            <p className="text-charcoal-muted">
              {pct >= 70 ? "Bagus. Pertahankan ritme ini." : "Masih bocor di beberapa pola. Pembahasan di bawah, lalu latih ulang."}
            </p>
          </div>
          {session.score !== null ? (
            <div className="rounded-[20px] bg-charcoal-raised px-5 py-4">
              <span className="block text-[0.75rem] font-extrabold tracking-[0.06em] text-charcoal-muted">SKOR BAGIAN</span>
              <span className="font-round text-[2.5rem] font-extrabold leading-none">{session.score}</span>
            </div>
          ) : null}
        </section>

        <section aria-label="Per skill" className="flex flex-col gap-2 rounded-[24px] border-2 border-hairline bg-surface p-5">
          {[...bySkill].map(([label, entry], i) => {
            const share = entry.total ? Math.round((entry.correct / entry.total) * 100) : 0;
            const weak = entry.correct * 2 < entry.total;
            return (
              <div key={label} className={cn("flex flex-wrap items-center gap-3 py-2", i > 0 && "border-t-2 border-hairline-soft")}>
                <span className="min-w-[160px] flex-1 font-bold">{label}</span>
                <span className="h-2.5 w-full max-w-[220px] overflow-hidden rounded-full bg-canvas-deep">
                  <span className={cn("block h-full", weak ? "bg-brick" : share >= 75 ? "bg-primary" : "bg-mango")} style={{ width: `${share}%` }} />
                </span>
                <span className="tnum w-12 text-right text-[0.875rem] font-extrabold">
                  {entry.correct}/{entry.total}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[0.75rem] font-extrabold",
                    weak ? "bg-brick-soft text-brick-deep" : "bg-primary-soft text-primary-deep",
                  )}
                >
                  {weak ? "Perlu latihan" : "Cukup"}
                </span>
              </div>
            );
          })}
        </section>

        {wrong.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-[1.375rem] font-extrabold">Pembahasan · {wrong.length} salah</h2>
            <ol className="flex flex-col gap-3">
              {wrong.map(({ item, i, answer }) => {
                const unanswered = answer === null || answer < 0;
                return (
                  <li key={i} className="flex flex-col gap-3 rounded-[24px] border-2 border-hairline bg-surface p-5">
                    <p className="text-[1.0625rem] font-semibold leading-relaxed">
                      <span className="mr-2 font-round font-extrabold text-ink-subtle">{i + 1}</span>
                      {item.q}
                    </p>
                    <div className="flex flex-wrap gap-2 text-[0.875rem] font-bold">
                      {unanswered ? (
                        <span className="rounded-[12px] bg-mango-soft px-3 py-1.5 text-mango-ink">Tidak dijawab</span>
                      ) : (
                        <span className="rounded-[12px] bg-brick-soft px-3 py-1.5 text-brick-deep">
                          Jawabanmu: {LETTERS[answer]} · {item.options[answer]}
                        </span>
                      )}
                      <span className="rounded-[12px] bg-primary-soft px-3 py-1.5 text-primary-deep">
                        Benar: {LETTERS[item.answer]} · {item.options[item.answer]}
                      </span>
                    </div>
                    {item.explain_id ? (
                      <p className="rounded-[14px] bg-surface-muted px-4 py-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                        <strong className="text-ink">Kenapa:</strong> {item.explain_id}
                      </p>
                    ) : null}
                    {item.skill ? (
                      <SkillChip skill={item.audio ? "listening" : session.section === "reading" ? "reading" : "structure"} className="self-start">
                        {SKILLS[item.skill].label}
                      </SkillChip>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        <div className="flex flex-wrap items-start justify-end gap-3">
          {repeatState.status === "error" ? (
            <p role="alert" className="w-full text-right text-[0.9375rem] font-bold text-brick-deep">
              {repeatState.message}
            </p>
          ) : null}
          <Link href={basePath} className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Kembali ke EPrT
          </Link>
          <form action={repeatAction}>
            <input type="hidden" name="kind" value={repeatKind} />
            {repeatSkill ? <input type="hidden" name="skill" value={repeatSkill} /> : null}
            <input type="hidden" name="track" value="eptr" />
            <Button type="submit" size="lg" disabled={repeatPending}>
              {repeatPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {repeatSkill ? `Latihan ulang: ${SKILLS[repeatSkill].label}` : "Latihan ulang"}
            </Button>
          </form>
        </div>
      </main>,
    );
  }

  const right = chosen === question.answer;
  // Pilihan baru menang atas jawaban lama: di soal yang dikunjungi ulang (mode
  // ujian non-audio) highlight harus mengikuti koreksi yang sedang dibuat.
  const selected = pending ?? chosen;
  const lastOpen = chosen === null && answers.filter((answer) => answer === null).length === 1;
  const last = answers.every((answer, i) => answer !== null || i === index);
  const isListening = Boolean(question.audio);
  const isWritten = question.type === "written";

  const optionGrid = isWritten ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : isListening ? "flex flex-col gap-3" : "grid gap-3 sm:grid-cols-2";

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
            disabled={chosen !== null && !canRevisit}
            onClick={() => choose(i)}
            className={cn(
              "flex min-h-[58px] items-center gap-3.5 rounded-[16px] border-2 px-4 py-2.5 text-left text-[1.0625rem] font-semibold transition-[transform,translate,box-shadow,border-color] active:translate-y-0.5",
              !revealed && !isSelected && "cursor-pointer border-hairline bg-surface shadow-[0_3px_0_var(--color-hairline)] hover:border-sky-line",
              !revealed && isSelected && "border-sky bg-sky-soft font-bold text-sky-deep shadow-[0_3px_0_var(--color-sky-line)]",
              revealed && isAnswer && "border-primary bg-primary-soft font-bold text-primary-deep shadow-[0_3px_0_var(--color-primary-line)]",
              revealed && isWrongPick && "border-brick bg-brick-soft font-bold text-brick-deep shadow-[0_3px_0_var(--color-brick-line)]",
              revealed && !isAnswer && !isWrongPick && "border-hairline bg-surface-muted text-ink-faint",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-[30px] shrink-0 items-center justify-center rounded-[8px] text-[0.8125rem] font-extrabold",
                !revealed && isSelected ? "bg-sky text-white" : "border-2 border-hairline text-ink-subtle",
                revealed && isAnswer && "border-0 bg-primary text-white",
                revealed && isWrongPick && "border-0 bg-brick text-white",
              )}
            >
              {revealed && isAnswer ? (
                <Check className="size-4" strokeWidth={3} />
              ) : revealed && isWrongPick ? (
                <X className="size-4" strokeWidth={3} />
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

  const hint =
    pending !== null
      ? exam
        ? "Pilihan masih bisa diganti sebelum lanjut."
        : "Pilihan masih bisa diganti sebelum diperiksa."
      : complete
        ? "Semua soal sudah dijawab."
        : "Pilih salah satu jawaban.";
  // Versi ringkas hint untuk footer di layar sempit (md ke bawah).
  const shortHint =
    pending !== null
      ? exam
        ? "bisa diganti sebelum lanjut."
        : "bisa diganti sebelum diperiksa."
      : hint;

  const primaryAction =
    pending !== null ? (
      !exam ? (
        <Button size="lg" onClick={() => commit()}>
          PERIKSA
        </Button>
      ) : lastOpen ? (
        <Button
          variant="exam"
          size="lg"
          onClick={() => {
            commit();
            void finish();
          }}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          Kunci &amp; selesai
        </Button>
      ) : (
        <Button variant="exam" size="lg" onClick={next}>
          Berikutnya
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      )
    ) : complete && !revealed ? (
      <Button variant={exam ? "exam" : "primary"} size="lg" onClick={finish} disabled={busy}>
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        Selesai
      </Button>
    ) : null;

  const numberNav =
    questions.length <= 60 ? (
      <nav aria-label="Navigasi nomor soal" className="grid min-w-0 flex-[1_1_420px] gap-1 [grid-template-columns:repeat(auto-fill,minmax(26px,1fr))]">
        {questions.map((_, n) => {
          const current = n === index;
          const done = answers[n] !== null;
          // Mode ujian non-audio: nomor soal terjawab tetap bisa diklik untuk koreksi.
          const canJump = !audioSession && !current && (!done || canRevisit);
          const cls = cn(
            "flex h-[26px] items-center justify-center rounded-[6px] border-2 text-[0.6875rem] font-extrabold",
            current && "border-sky bg-sky text-white",
            !current && done && "border-ink-muted bg-ink-muted text-white",
            !current && !done && "border-hairline-strong bg-surface text-ink-subtle",
            canJump && "cursor-pointer hover:border-sky",
          );
          const label = `Soal ${n + 1}, ${current ? "sekarang" : done ? "dijawab" : "belum"}`;
          return canJump ? (
            <button key={n} type="button" aria-label={label} onClick={() => jump(n)} className={cls}>
              {n + 1}
            </button>
          ) : (
            <span key={n} aria-label={label} aria-current={current ? "step" : undefined} className={cls}>
              {n + 1}
            </span>
          );
        })}
      </nav>
    ) : (
      <span className="flex-1" />
    );

  const actionBar = (
    <footer className="sticky bottom-0 z-20 border-t-2 border-hairline bg-surface">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        {numberNav}
        <span className="hidden text-[0.8125rem] font-bold text-ink-subtle md:inline">{hint}</span>
        <span className="text-[0.8125rem] font-bold text-ink-subtle md:hidden">{shortHint}</span>
        {primaryAction}
      </div>
      {exam ? (
        <p className="mx-auto max-w-[1360px] px-4 pb-3 text-[0.75rem] font-bold text-ink-subtle sm:px-6">
          Benar/salah tidak ditampilkan sampai simulasi selesai.
        </p>
      ) : null}
    </footer>
  );

  const structureParts =
    revealed && question.type === "structure" && chosen !== null
      ? blankAnatomy(question.q, right ? null : question.options[chosen], question.options[question.answer])
      : null;

  const feedback = revealed ? (
    <div
      role="status"
      className={cn(
        "page-enter flex flex-col gap-4 rounded-[24px] border-2 p-5 sm:p-6",
        right ? "border-primary-line bg-primary-soft" : "border-brick-line bg-brick-soft",
      )}
    >
      <div className="flex flex-wrap items-center gap-3.5">
        <span
          aria-hidden
          className={cn("grid size-12 shrink-0 place-items-center rounded-full text-white", right ? "bg-primary" : "bg-brick")}
        >
          {right ? <Check className="size-6" strokeWidth={3} /> : <X className="size-6" strokeWidth={3} />}
        </span>
        <div className={cn("min-w-0 flex-1", right ? "text-primary-deep" : "text-brick-deep")}>
          <p className="font-display text-[1.375rem] font-black">{right ? "Benar!" : "Belum tepat"}</p>
          {!right ? (
            <p className="text-[0.9375rem]">
              Jawaban benar:{" "}
              <strong>
                {LETTERS[question.answer]}. {question.options[question.answer]}
              </strong>
            </p>
          ) : null}
        </div>
        <Button autoFocus size="lg" onClick={next} disabled={busy} className={right ? undefined : "bg-brick shadow-[0_5px_0_var(--color-brick-deep)] hover:bg-brick-bright"}>
          {last ? "Lihat hasil" : "Soal berikutnya"}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
      </div>
      {structureParts && !right ? (
        <div className="rounded-[18px] bg-surface p-4">
          <Anatomy parts={structureParts} size="sm" />
        </div>
      ) : null}
      {question.explain_id ? (
        <p className="rounded-[14px] bg-surface px-4 py-3 text-[1rem] leading-relaxed text-ink-muted">{question.explain_id}</p>
      ) : null}
      {question.audio ? (
        <details className="rounded-[14px] bg-surface px-4 py-3">
          <summary className="cursor-pointer text-[0.9375rem] font-extrabold">Lihat transkrip</summary>
          <div className="mt-2 flex flex-col gap-1 text-[0.9375rem] leading-relaxed">
            {question.audio.map((line, i) => (
              <p key={i}>
                <span className="font-bold">{SPEAKER[line.speaker]}:</span> {line.text}
              </p>
            ))}
          </div>
        </details>
      ) : null}
      {error ? (
        <p role="alert" className="text-[0.9375rem] font-bold text-brick-deep">
          {error}
        </p>
      ) : null}
    </div>
  ) : null;

  const questionHeading = (
    <h1
      id="question-text"
      className={cn(
        "font-semibold leading-[1.5]",
        isWritten || question.type === "structure" ? "text-[1.375rem] sm:text-[1.625rem]" : "text-[1.25rem] sm:text-[1.375rem]",
      )}
    >
      {isListening ? question.q : <Sentence question={question} revealed={revealed} />}
    </h1>
  );

  const body = (askOpen: boolean, trigger?: React.ReactNode) =>
    shell(
      <>
        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6">
          <div
            className={cn(
              "grid gap-6",
              // Panel AI terbuka = ruang sempit: tumpuk teks/audio di atas soal.
              (isListening || session.passage) && !askOpen && "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
            )}
          >
            {isListening ? (
              <section
                aria-label="Audio"
                className="flex flex-col justify-between gap-5 rounded-[28px] bg-charcoal p-5 text-charcoal-ink sm:p-8 lg:min-h-[440px]"
              >
                <div className="flex flex-col gap-2">
                  <span className="eyebrow text-mango-line">{TYPE_LABEL.listening}</span>
                  <p className="text-charcoal-muted">
                    {exam ? "Dengarkan percakapan, lalu narator membacakan pertanyaan." : "Putar audio, dengarkan, lalu pilih jawaban."}
                  </p>
                </div>
                <div aria-hidden className={cn("h-24 items-center justify-center gap-1.5", speaking ? "flex" : "hidden sm:flex")}>
                  {[60, 100, 130, 80, 110, 70, 120, 50, 90, 75, 105].map((height, i) => (
                    <span
                      key={i}
                      className={cn("w-2 rounded bg-sky-bright", speaking && !loadingAudio ? "wave-bar" : "opacity-35")}
                      style={{ height: speaking && !loadingAudio ? height * 0.75 : 16, animationDelay: `${i * 0.08}s` }}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  {speaking ? (
                    <p role="status" className="flex h-14 items-center justify-center gap-2.5 rounded-[16px] bg-charcoal-raised text-[1.0625rem] font-bold">
                      {loadingAudio ? (
                        <Loader2 className="size-5 animate-spin text-sky-bright" aria-hidden />
                      ) : (
                        <Volume2 className="size-5 text-sky-bright" aria-hidden />
                      )}
                      {loadingAudio ? "Memuat audio…" : "Sedang diputar"}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={play}
                      className="flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-[16px] bg-sky text-[1.0625rem] font-extrabold text-white shadow-[0_5px_0_var(--color-sky-deep)] transition-transform active:translate-y-[5px] active:shadow-none"
                    >
                      <Volume2 className="size-5" aria-hidden />
                      {audioUsed ? "Dengar pertanyaan lagi" : "Putar audio"}
                    </button>
                  )}
                  <p className="text-center text-[0.875rem] text-charcoal-muted">
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
                  <div className="flex flex-col gap-1 rounded-[14px] bg-charcoal-raised p-4 leading-relaxed">
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
                className="flex flex-col gap-3.5 self-start rounded-[24px] border-2 border-hairline bg-surface p-5 sm:p-8 lg:sticky lg:top-24"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="eyebrow text-ink-subtle">Teks bacaan</span>
                  <div role="group" aria-label="Ukuran teks" className="flex gap-1.5">
                    <button
                      type="button"
                      aria-label="Perkecil teks bacaan"
                      disabled={textSize === 0}
                      onClick={() => changeTextSize(-1)}
                      className="size-10 cursor-pointer rounded-[10px] border-2 border-hairline bg-surface font-display text-[0.875rem] font-extrabold disabled:opacity-40"
                    >
                      A−
                    </button>
                    <button
                      type="button"
                      aria-label="Perbesar teks bacaan"
                      disabled={textSize === TEXT_SIZES.length - 1}
                      onClick={() => changeTextSize(1)}
                      className="size-10 cursor-pointer rounded-[10px] border-2 border-hairline bg-surface font-display text-[1rem] font-extrabold disabled:opacity-40"
                    >
                      A+
                    </button>
                  </div>
                </div>
                <div className={cn("flex max-h-[62dvh] max-w-[68ch] flex-col gap-4 overflow-y-auto leading-[1.75]", TEXT_SIZES[textSize])}>
                  {session.passage
                    .split(/\n\s*\n/)
                    .filter((paragraph) => paragraph.trim())
                    .map((paragraph, i) => (
                      <p key={i}>
                        <span className="mr-2 font-round text-[0.9375rem] font-extrabold text-ink-subtle">{i + 1}</span>
                        {parseInline(paragraph.trim()).map((span, j) =>
                          span.tone === "bold" ? (
                            <strong key={j} className="rounded bg-sky-soft px-1 font-bold text-sky-deep">
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

            <section
              key={index}
              className={cn(
                "flex flex-col gap-5",
                !isListening && !session.passage && "mx-auto w-full max-w-[860px]",
              )}
            >
              <div className="flex flex-col gap-4 rounded-[24px] border-2 border-hairline bg-surface p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-round text-[1.375rem] font-extrabold text-sky-deep">{index + 1}</span>
                  <span className="eyebrow text-ink-subtle">
                    {isListening ? "Pertanyaan narator" : (TYPE_LABEL[question.type] ?? "Soal")}
                  </span>
                </div>
                {questionHeading}
                {options}
              </div>
              {feedback}
              {!revealed && error ? (
                <p role="alert" className="text-[0.9375rem] font-bold text-brick-deep">
                  {error}
                </p>
              ) : null}
            </section>
          </div>
        </main>
        <div
          aria-hidden={revealed}
          className={cn("sticky bottom-0", revealed && "invisible pointer-events-none")}
        >
          {actionBar}
        </div>
      </>,
      trigger,
    );

  // Mode ujian: render tanpa pembungkus AskAi — trigger "Tanya AI" tidak boleh muncul.
  if (exam) return body(false);

  return (
    <AskAi
      section={session.section}
      context={[
        session.passage ? `Teks bacaan:\n${session.passage}` : "",
        // Transkrip audio hanya dikirim setelah jawaban diperiksa (bukan saat ujian).
        revealed && question.audio
          ? `Transkrip:\n${question.audio.map((line) => `${line.speaker}: ${line.text}`).join("\n")}`
          : question.audio
            ? "Ini soal Listening dan kamu tidak punya transkrip audionya. Jangan menebak isi rekaman; beri strategi mendengar saja."
            : "",
        `Soal (${session.section}): ${question.q}`,
        ...question.options.map((option, i) => `${LETTERS[i]}. ${option}`),
      ]
        .filter(Boolean)
        .join("\n")}
    >
      {(askOpen, trigger) => body(askOpen, trigger)}
    </AskAi>
  );
}
