"use client";

import { AlignLeft, ArrowLeft, ArrowRight, Check, Flag, GraduationCap, Loader2, Lock, Pause, RotateCcw, Timer, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Kaka } from "@/components/mascot";
import { PendingOverlay } from "@/components/pending-overlay";
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
import { sfx } from "@/lib/sfx";
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
  structure: "Sentence Completion",
  written: "Error Recognition",
  reading: "Reading",
  listening: "Listening",
};
const TYPE_HINT: Record<string, string> = {
  structure: "Pilih kata atau frasa yang melengkapi kalimat.",
  written: "Pilih bagian bergaris bawah yang salah.",
};
const SECTION_NAME: Record<string, string> = {
  listening: "Listening",
  structure: "Structure",
  reading: "Reading",
};

// Gaya layar kerja: kartu putih, bayangan lembut, tombol hijau tanpa ledge.
const CARD =
  "rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(40,30,10,0.05),0_8px_28px_rgba(40,30,10,0.06)]";
const BTN_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-[14px] font-bold transition-[background-color,transform,box-shadow] duration-150 disabled:cursor-not-allowed disabled:translate-y-0";
const BTN = `${BTN_BASE} h-[52px] bg-primary px-7 text-[1rem] text-white shadow-[0_6px_16px_rgba(30,122,76,0.28)] hover:-translate-y-px hover:bg-primary-deep active:translate-y-px active:shadow-[0_2px_6px_rgba(30,122,76,0.28)] disabled:bg-surface disabled:text-ink-subtle disabled:shadow-[inset_0_0_0_1.5px_var(--color-hairline-strong)]`;
const BTN_SOFT = `${BTN_BASE} h-11 bg-surface px-[18px] text-[0.9375rem] text-ink shadow-[inset_0_0_0_1.5px_var(--color-hairline-strong)] hover:bg-canvas disabled:opacity-40`;
const FLAG_BTN =
  "inline-flex h-11 cursor-pointer items-center gap-2 rounded-[14px] border-[1.5px] border-hairline-strong bg-surface px-4 text-[0.9375rem] font-semibold transition-colors hover:bg-canvas aria-pressed:border-mango aria-pressed:bg-mango-soft";
const HEADER_FOCUS = "focus-visible:outline-mango-line";
// Tinggi batang gelombang audio (deterministik, jadi aman untuk hydration).
const WAVE = Array.from({ length: 36 }, (_, i) =>
  18 + Math.round(Math.abs(Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.5) * 0.4) * 54),
);
const SPEEDS = [
  { value: 0.75, label: "0,75×" },
  { value: 1, label: "1×" },
];
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

function loadFlags(sessionId: number): Set<number> {
  try {
    const raw = window.localStorage.getItem(`eprt-flags:${sessionId}`);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function saveFlags(sessionId: number, flags: Set<number>) {
  try {
    window.localStorage.setItem(`eprt-flags:${sessionId}`, JSON.stringify([...flags]));
  } catch {
    // Tanda ragu-ragu hanya bantuan tampilan; aman diabaikan.
  }
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Dialog selesai-section: ringkasan dijawab/kosong/ragu-ragu sebelum bagian dikunci. */
function FinishDialog({
  open,
  name,
  answered,
  blank,
  flagged,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  name: string;
  answered: number;
  blank: number;
  flagged: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const tiles = [
    { n: answered, label: "dijawab", cls: "bg-primary-soft", num: "" },
    { n: blank, label: "kosong", cls: "bg-brick-soft", num: "text-brick-deep" },
    { n: flagged, label: "ragu-ragu", cls: "bg-mango-soft", num: "" },
  ];

  return (
    <dialog
      ref={ref}
      aria-labelledby="finish-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onCancel();
      }}
      className="pop m-auto w-[min(92vw,28.75rem)] rounded-[24px] bg-surface p-0 text-ink shadow-overlay backdrop:bg-black/55"
    >
      <div className="flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h2 id="finish-title" className="font-display text-[1.625rem] font-bold">
            Selesaikan {name}?
          </h2>
          <p className="text-[1rem] leading-relaxed text-ink-muted">
            Setelah selesai, bagian ini tidak bisa dibuka lagi.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {tiles.map((tile) => (
            <span key={tile.label} className={cn("rounded-[14px] px-2.5 py-3.5 text-center", tile.cls)}>
              <strong className={cn("tnum block font-display text-[1.75rem] leading-none", tile.num)}>{tile.n}</strong>
              <span className="text-[0.8125rem] font-semibold text-ink-subtle">{tile.label}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" className={BTN_SOFT} onClick={onCancel}>
            Kembali memeriksa
          </button>
          <button type="button" className={cn(BTN, "h-11 px-[18px] text-[0.9375rem]")} onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Selesai section
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Sentence({
  question,
  revealed,
  filled,
}: {
  question: ToeflQuestion;
  revealed: boolean;
  /** Rumpang structure diisi jawaban benar hanya bila murid menjawab benar; kalau salah, pembahasan di bawah yang menunjukkan. */
  filled: boolean;
}) {
  if (question.type === "structure") {
    const [before, ...rest] = question.q.split(/_{2,}/);
    return (
      <>
        {before}
        {rest.length ? (
          filled ? (
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
            <strong key={i} className="rounded bg-mango-mark px-1 font-bold text-ink">
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
            "border-b-[3px] border-ink px-0.5",
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
  basePath = "/toefl",
  exam = false,
  timeLeftMs,
  voice = DEFAULT_PREFS,
  skillAcc,
}: {
  session: ActiveSession;
  basePath?: string;
  /** Mode ujian: kunci jawaban dan pembahasan disembunyikan, audio hanya sekali putar. */
  exam?: boolean;
  /** Sisa waktu section saat halaman dimuat; bagian ditutup otomatis saat habis. */
  timeLeftMs?: number;
  /** Suara Listening dari pengaturan admin. */
  voice?: VoicePrefs;
  /** Akurasi pengguna per skill (persen, sudah cukup data); dipakai untuk label topik prioritas di mode latihan. */
  skillAcc?: Partial<Record<SkillKey, number>>;
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
  const router = useRouter();
  const [askExit, setAskExit] = useState(false);
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
  // Mode ujian non-audio: soal yang ditandai ragu-ragu (disimpan per sesi di browser).
  const [flags, setFlags] = useState<Set<number>>(() => new Set());
  const [askFinish, setAskFinish] = useState(false);
  const [audSec, setAudSec] = useState(0);
  // Mode latihan: kecepatan audio (pengali dari kecepatan dasar admin) dan soal yang audionya sudah pernah diputar.
  const [speed, setSpeed] = useState(1);
  const [heardIdx, setHeardIdx] = useState<number | null>(null);
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
      if (Number(window.localStorage.getItem("eprt-audio-speed")) === 0.75) setSpeed(0.75);
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

  function changeSpeed(value: number) {
    setSpeed(value);
    try {
      window.localStorage.setItem("eprt-audio-speed", String(value));
    } catch {
      // abaikan
    }
  }

  /** Putaran audio terbaru; callback putaran lama (dipotong) diabaikan. */
  const sayRef = useRef(0);

  /** `markKey`: dialog baru dihitung "sudah diputar" kalau selesai didengar, bukan saat mulai
   *  (soal berbagi dialog yang dilewati cepat tidak boleh kehilangan dialognya). */
  function say(target: ToeflQuestion, questionOnly = false, markKey?: number) {
    const id = ++sayRef.current;
    setAudSec(0);
    setSpeaking(true);
    setLoadingAudio(true);
    speak(
      target,
      exam ? voice : { ...voice, rate: voice.rate * speed },
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
    setAudSec(0);
    stopSpeech();
    setSpeaking(false);
    setLoadingAudio(false);
  }

  useEffect(() => {
    if (exam) {
      setPlayed(loadPlayed(session.id));
      setFlags(loadFlags(session.id));
    }
  }, [exam, session.id]);

  // Penghitung lama audio berjalan (durasi total tidak diketahui dari speech synthesis).
  useEffect(() => {
    if (!speaking || loadingAudio) return;
    const timer = window.setInterval(() => setAudSec((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [speaking, loadingAudio]);

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
    // Latihan menampilkan pembahasan langsung, jadi beri bunyi benar/salah (ujian tidak boleh membocorkan).
    if (!exam) (pending === questions[index].answer ? sfx.correct : sfx.wrong)();
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
    setHeardIdx(index);
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

  function toggleFlag() {
    if (index === null || !canRevisit) return;
    setFlags((prev) => {
      const nextSet = new Set(prev);
      if (!nextSet.delete(index)) nextSet.add(index);
      saveFlags(session.id, nextSet);
      return nextSet;
    });
  }

  /** Konfirmasi dialog selesai-section: kunci pilihan yang sedang dipilih, lalu tutup bagian. */
  function confirmFinish() {
    setAskFinish(false);
    commit();
    void finish();
  }

  // Pilihan yang belum dikirim ikut dihitung di ringkasan dialog selesai.
  const pendingExtra =
    index !== null && pending !== null && (answers[index] === null || answers[index] === -1) ? 1 : 0;
  const shownAnswered = answeredCount + pendingExtra;
  const sectionName = SECTION_NAME[session.section] ?? "bagian ini";

  const header = (trigger?: React.ReactNode) => (
    <header className="sticky top-0 z-30 bg-charcoal pt-[env(safe-area-inset-top)] text-charcoal-ink">
      <ConfirmDialog
        open={askExit}
        title="Keluar dari simulasi?"
        message="Jawabanmu tersimpan. Timer section tetap berjalan walau kamu keluar."
        confirmLabel="Keluar"
        cancelLabel="Lanjut mengerjakan"
        danger
        onConfirm={() => router.push(basePath)}
        onCancel={() => setAskExit(false)}
      />
      <FinishDialog
        open={askFinish}
        name={sectionName}
        answered={shownAnswered}
        blank={Math.max(0, questions.length - shownAnswered)}
        flagged={flags.size}
        busy={busy}
        onConfirm={confirmFinish}
        onCancel={() => setAskFinish(false)}
      />
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <span className="hidden items-center gap-2 text-[0.75rem] font-bold tracking-[0.08em] text-charcoal-muted md:flex">
          <GraduationCap className="size-[18px] text-mango-line" strokeWidth={2.2} aria-hidden />
          {exam ? "SIMULASI · MODE UJIAN" : "LATIHAN TOEFL ITP"}
        </span>
        <span className="min-w-0 flex-[1_1_9rem] truncate font-display text-[1.0625rem] font-bold">{session.label}</span>
        {index !== null ? (
          <span className="tnum hidden text-[0.875rem] font-bold text-charcoal-muted md:inline">
            Soal {index + 1} dari {questions.length}
          </span>
        ) : null}
        <div className="flex items-center gap-2">
          {left !== null && !finished && timerVisible ? (
            <span
              role="timer"
              aria-label={`Sisa waktu ${formatClock(left)}`}
              className={cn(
                "tnum flex h-[42px] items-center gap-2 rounded-[12px] px-3.5 font-mono text-[1.25rem] font-bold",
                lowTime ? "bg-brick text-white" : "bg-mango-line text-mango-on",
              )}
            >
              <Timer className="size-[18px]" strokeWidth={2.6} aria-hidden />
              {formatClock(left)}
            </span>
          ) : null}
          {left !== null && !finished && !lowTime ? (
            <button
              type="button"
              aria-pressed={hideTimer}
              onClick={toggleTimer}
              className={cn(
                "h-11 cursor-pointer rounded-[12px] border-[1.5px] border-white/20 px-3.5 text-[0.8125rem] font-bold transition-colors hover:bg-white/10",
                HEADER_FOCUS,
              )}
            >
              {hideTimer ? "Tampilkan timer" : "Sembunyikan timer"}
            </button>
          ) : null}
          {trigger}
          <Link
            href={basePath}
            aria-label={index === null ? "Keluar" : "Simpan dan keluar"}
            title={index === null ? "Keluar" : "Simpan & keluar"}
            onClick={(event) => {
              // Timer section jalan di server walau browser ditutup; pastikan keluar
              // memang disengaja selagi waktu masih berjalan.
              if (deadline !== null && !finished) {
                event.preventDefault();
                setAskExit(true);
              }
            }}
            className={cn(
              "flex h-11 items-center gap-2 rounded-[12px] border-[1.5px] border-white/20 px-3.5 text-[0.8125rem] font-bold transition-colors hover:bg-white/10",
              HEADER_FOCUS,
            )}
          >
            {index === null ? <X className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
            <span className="hidden sm:inline">{index === null ? "Keluar" : "Simpan & keluar"}</span>
          </Link>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={`${answeredCount} dari ${questions.length} soal dijawab`}
        aria-valuenow={Math.round((answeredCount / Math.max(1, questions.length)) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 bg-white/15"
      >
        <div
          className="h-full w-full origin-left bg-mango-line transition-transform duration-300 ease-[var(--ease-out)]"
          style={{ transform: `scaleX(${answeredCount / Math.max(1, questions.length)})` }}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <p role="status" className="sr-only">
        {index !== null ? `Soal ${index + 1} dari ${questions.length}. ${answeredCount} soal dijawab.` : ""}
      </p>
      {lowTime && !finished && left !== null ? (
        <p role="alert" className="bg-brick-soft px-4 py-2.5 text-center text-[0.9375rem] font-bold text-brick-deep">
          Waktu tinggal kurang dari 5 menit. Jawaban yang sudah dipilih tersimpan otomatis.
        </p>
      ) : null}
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
        <section
          aria-labelledby="done-title"
          className={cn(CARD, "page-enter flex w-full max-w-[560px] flex-col items-center gap-4 px-6 py-10 text-center sm:px-9")}
        >
          <span aria-hidden className="flex size-[72px] items-center justify-center rounded-full bg-primary-soft text-primary">
            <Check className="size-9" strokeWidth={2.6} />
          </span>
          <h1 id="done-title" className="font-display text-[2.125rem] font-bold">
            Bagian selesai
          </h1>
          <p className="max-w-md text-[1.0625rem] leading-relaxed text-ink-muted">
            {answeredCount} dari {questions.length} soal dijawab. Skor dan pembahasan muncul setelah semua bagian simulasi selesai.
          </p>
          {error ? (
            <p role="alert" className="text-[0.9375rem] font-bold text-brick-deep">
              {error}
            </p>
          ) : null}
          <div className="pt-2">
            {finished ? (
              <Link href={basePath} className={BTN}>
                Lanjut ke bagian berikutnya
                <ArrowRight className="size-5" aria-hidden />
              </Link>
            ) : (
              <button type="button" className={BTN} onClick={finish} disabled={busy}>
                {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                Simpan bagian ini
              </button>
            )}
          </div>
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
    // Satu soal belum cukup untuk menilai pola; yang terlemah naik ke atas, data sedikit di bawah.
    const skillRows = [...bySkill]
      .map(([label, entry]) => {
        const share = Math.round((entry.correct / entry.total) * 100);
        const level =
          entry.total < 2
            ? { text: "Data sedikit", share, bar: "bg-ink-faint", badge: "bg-surface-muted text-ink-subtle" }
            : share < 50
              ? { text: "Perlu latihan", share, bar: "bg-brick", badge: "bg-brick-soft text-brick-deep" }
              : share >= 80
                ? { text: "Kuat", share, bar: "bg-primary", badge: "bg-primary-soft text-primary-deep" }
                : { text: "Cukup", share, bar: "bg-mango", badge: "bg-mango-soft text-mango-ink" };
        return { label, entry, level, rank: entry.total < 2 ? 2 : share / 100 };
      })
      .sort((a, b) => a.rank - b.rank);
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
          <div className="mt-3 flex flex-wrap items-start gap-3">
            {repeatState.status === "error" ? (
              <p role="alert" className="w-full text-[0.9375rem] font-bold text-mango-line">
                {repeatState.message}
              </p>
            ) : null}
            {repeatPending ? <PendingOverlay hint="Soal diambil dari bank, biasanya hanya beberapa detik." /> : null}
            <form action={repeatAction}>
              <input type="hidden" name="kind" value={repeatKind} />
              {repeatSkill ? <input type="hidden" name="skill" value={repeatSkill} /> : null}
              <input type="hidden" name="track" value="eptr" />
              <Button type="submit" size="lg" disabled={repeatPending}>
                {repeatPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                {repeatSkill ? `Latihan ulang: ${SKILLS[repeatSkill].label}` : "Latihan ulang"}
              </Button>
            </form>
            <Link href={basePath} className={buttonVariants({ variant: "secondary", size: "lg" })}>
              Kembali ke TOEFL ITP
            </Link>
          </div>
          </div>
          {session.score !== null ? (
            <div className="rounded-[20px] bg-charcoal-raised px-5 py-4">
              <span className="block text-[0.75rem] font-extrabold tracking-[0.06em] text-charcoal-muted">SKOR BAGIAN</span>
              <span className="font-round text-[2.5rem] font-extrabold leading-none">{session.score}</span>
            </div>
          ) : null}
        </section>

        <section aria-label="Per skill" className="flex flex-col rounded-[24px] border-2 border-hairline bg-surface px-5 py-2">
          {skillRows.map(({ label, entry, level }, i) => (
            <div
              key={label}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_200px_3rem_7.5rem]",
                i > 0 && "border-t-2 border-hairline-soft",
              )}
            >
              <span className="font-bold">{label}</span>
              <span className="tnum order-4 text-right text-[0.875rem] font-extrabold sm:order-none">
                {entry.correct}/{entry.total}
              </span>
              <span className="order-3 h-2.5 overflow-hidden rounded-full bg-canvas-deep sm:order-none sm:col-start-2 sm:row-start-1">
                <span className={cn("block h-full", level.bar)} style={{ width: `${level.share}%` }} />
              </span>
              <span className={cn("order-2 w-[7.5rem] rounded-full px-2.5 py-0.5 text-center text-[0.75rem] font-extrabold sm:order-none", level.badge)}>
                {level.text}
              </span>
            </div>
          ))}
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
  const lastQuestion = index === questions.length - 1;
  const showNav = !audioSession && questions.length <= 60;
  const flagOn = flags.has(index);
  const playing = speaking && !loadingAudio;
  const paragraphs = (session.passage ?? "").split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
  // Soal Reading yang menyebut "paragraph N" (aturan generator) mendapat tombol loncat ke paragraf itu.
  const paraNo =
    !exam && !isListening && question.type === "reading" ? Number(/paragraph\s+(\d{1,2})/i.exec(question.q)?.[1]) : NaN;
  const showParaLink = paraNo >= 1 && paraNo <= paragraphs.length;
  // Label topik prioritas (akurasi < 60%) untuk soal Structure/Reading di mode latihan.
  const topicAcc = !exam && !isListening && question.skill ? skillAcc?.[question.skill] : undefined;

  function showParagraph(n: number) {
    const el = document.getElementById(`para-${n}`);
    if (!el) return;
    const prm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: prm ? "auto" : "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  const options = (
    <div role="radiogroup" aria-labelledby="question-text" className="flex flex-col gap-3">
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
              "flex min-h-16 w-full items-center gap-3.5 rounded-[16px] border-2 py-2.5 pl-3 pr-4 text-left text-[1rem] font-medium leading-snug transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] sm:gap-4 sm:pr-[18px] sm:text-[1.0625rem]",
              !revealed && !isSelected && "cursor-pointer border-hairline bg-surface hover:border-primary-line",
              !revealed && isSelected && "border-primary bg-primary-soft font-semibold",
              revealed && isAnswer && "border-primary bg-primary-soft font-semibold text-primary-deep",
              revealed && isWrongPick && "border-brick bg-brick-soft font-semibold text-brick-deep",
              revealed && !isAnswer && !isWrongPick && "border-hairline bg-surface-muted text-ink-faint",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-[12px] font-mono text-[0.9375rem] font-bold transition-colors",
                !revealed && isSelected && "bg-primary text-white",
                !revealed && !isSelected && "bg-canvas text-ink-subtle",
                revealed && isAnswer && "bg-primary text-white",
                revealed && isWrongPick && "bg-brick text-white",
                revealed && !isAnswer && !isWrongPick && "bg-canvas text-ink-faint",
              )}
            >
              {LETTERS[i]}
            </span>
            <span className="min-w-0 flex-1">{option}</span>
            {revealed && isAnswer ? <Check aria-hidden className="size-5 shrink-0" strokeWidth={3} /> : null}
            {revealed && isWrongPick ? <X aria-hidden className="size-5 shrink-0" strokeWidth={3} /> : null}
          </button>
        );
      })}
    </div>
  );

  const hint = revealed
    ? right
      ? "Benar. Lanjut kalau sudah paham."
      : "Baca pembahasan di bawah, lalu lanjut."
    : pending !== null
      ? exam
        ? "Pilihan masih bisa diganti sebelum lanjut."
        : "Pilihan masih bisa diganti sebelum diperiksa."
      : complete
        ? "Semua soal sudah dijawab."
        : "Pilih salah satu jawaban.";

  const arrow = <ArrowRight className="size-5" aria-hidden />;

  const primaryAction = (() => {
    if (revealed) {
      return (
        <button
          type="button"
          autoFocus
          className={BTN}
          onClick={next}
          disabled={busy}
        >
          {last ? "Lihat hasil" : "Soal berikutnya"}
          {arrow}
        </button>
      );
    }
    if (!exam) {
      if (pending !== null) {
        return (
          <button type="button" className={BTN} onClick={() => commit()}>
            Periksa
          </button>
        );
      }
      if (complete) {
        return (
          <button type="button" className={BTN} onClick={finish} disabled={busy}>
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
            Selesai
          </button>
        );
      }
      return (
        <button type="button" className={BTN} disabled>
          Periksa
        </button>
      );
    }
    if (canRevisit) {
      return (
        <button
          type="button"
          className={BTN}
          onClick={lastQuestion ? () => setAskFinish(true) : () => jump(index + 1)}
        >
          {lastQuestion ? "Selesai section" : "Lanjut"}
          {arrow}
        </button>
      );
    }
    // Ujian dengan audio: urutan terkunci, jawab dulu baru lanjut.
    const finalOne = lastOpen && pending !== null;
    return (
      <button
        type="button"
        className={BTN}
        disabled={pending === null && chosen === null}
        onClick={finalOne ? () => setAskFinish(true) : next}
      >
        {finalOne ? "Selesai section" : "Lanjut"}
        {arrow}
      </button>
    );
  })();

  const footerLeft = canRevisit ? (
    <button type="button" className={BTN_SOFT} disabled={index === 0 || busy} onClick={() => jump(index - 1)}>
      <ArrowLeft className="size-[18px]" aria-hidden />
      Sebelumnya
    </button>
  ) : exam ? (
    <span className="inline-flex items-center gap-2 text-[0.8125rem] font-medium text-ink-subtle">
      <Lock className="size-4" aria-hidden />
      Soal sebelumnya sudah terkunci
    </span>
  ) : (
    <span className="text-[0.8125rem] font-semibold text-ink-subtle">{hint}</span>
  );

  // Daftar soal: hanya sesi tanpa audio (sesi audio urutannya terkunci).
  const navPanel = showNav ? (
    <aside aria-label="Daftar soal" className={cn(CARD, "flex flex-col gap-4 p-5 sm:p-6")}>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[1.25rem] font-bold">Daftar soal</h2>
        <p className="text-[0.8125rem] font-medium text-ink-subtle">
          {canRevisit ? "Ketuk nomor untuk lompat ke soal itu." : "Soal yang sudah dijawab tidak bisa dibuka lagi."}
        </p>
      </div>
      <nav aria-label="Navigasi nomor soal" className="grid grid-cols-8 gap-1.5">
        {questions.map((_, n) => {
          const current = n === index;
          const done = (answers[n] !== null && answers[n] !== -1) || (current && pending !== null);
          const flagged = flags.has(n);
          // Mode ujian non-audio: nomor soal terjawab tetap bisa diklik untuk koreksi.
          const canJump = !current && (answers[n] === null || canRevisit);
          const label = `Soal ${n + 1}, ${current ? "sekarang" : done ? "sudah dijawab" : "belum dijawab"}${flagged ? ", ragu-ragu" : ""}`;
          return (
            <button
              key={n}
              type="button"
              aria-label={label}
              aria-current={current ? "step" : undefined}
              disabled={!canJump && !current}
              onClick={() => jump(n)}
              className={cn(
                "tnum h-11 w-full rounded-[10px] border-2 text-[0.8125rem] font-bold transition-transform",
                canJump && "cursor-pointer hover:-translate-y-px",
                flagged
                  ? "border-mango bg-mango-line text-ink"
                  : done
                    ? "border-primary bg-primary text-white"
                    : "border-hairline-strong bg-surface text-ink-subtle",
                current && "border-[3px] border-charcoal",
                !canJump && !current && "cursor-default",
              )}
            >
              {n + 1}
            </button>
          );
        })}
      </nav>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-[0.8125rem] font-semibold text-ink-muted">
        {[
          ["bg-primary border-primary", "Dijawab"],
          ["bg-mango-line border-mango", "Ragu-ragu"],
          ["bg-surface border-hairline-strong", "Belum dijawab"],
          ["bg-surface border-[3px] border-charcoal", "Sekarang"],
        ].map(([swatch, text]) => (
          <li key={text} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-3.5 rounded-[4px] border-[1.5px]", swatch)} />
            {text}
          </li>
        ))}
      </ul>
      {canRevisit ? (
        <button type="button" className={BTN_SOFT} onClick={() => setAskFinish(true)}>
          Selesai section
        </button>
      ) : null}
    </aside>
  ) : null;

  // Pembahasan structure salah: kalimat utuh dua baris, jawabanmu vs yang benar.
  const [blankBefore, ...blankAfter] = question.q.split(/_{2,}/);
  const diffRows =
    revealed && question.type === "structure" && !right && chosen !== null && blankAfter.length
      ? [
          { label: "Jawabanmu", fill: question.options[chosen], tone: "text-brick-deep", chip: "bg-brick-soft", strike: true },
          { label: "Benar", fill: question.options[question.answer], tone: "text-primary-deep", chip: "bg-primary-soft", strike: false },
        ]
      : null;

  const feedback = revealed ? (
    <div role="status" className="page-enter flex flex-col gap-3.5">
      <div
        className={cn(
          "flex items-center gap-3 rounded-[16px] px-[18px] py-4",
          right ? "bg-primary-soft text-primary-deep" : "bg-brick-soft text-brick-deep",
        )}
      >
        <span
          aria-hidden
          className={cn("grid size-8 shrink-0 place-items-center rounded-full text-white", right ? "bg-primary" : "bg-brick")}
        >
          {right ? <Check className="size-[18px]" strokeWidth={3} /> : <X className="size-[18px]" strokeWidth={3} />}
        </span>
        <strong className="text-[1.0625rem]">
          {right
            ? `Benar. Jawabannya ${LETTERS[question.answer]}.`
            : chosen !== null && chosen >= 0
              ? `Belum tepat. Jawabanmu ${LETTERS[chosen]}, kuncinya ${LETTERS[question.answer]}.`
              : `Belum tepat. Kuncinya ${LETTERS[question.answer]}.`}
        </strong>
      </div>
      {diffRows ? (
        <div className="flex flex-col gap-2.5 rounded-[16px] border-2 border-hairline-soft bg-surface p-4 text-[1.0625rem] leading-relaxed">
          {diffRows.map((row) => (
            <p key={row.label} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3">
              <span className={cn("justify-self-start rounded-full px-2.5 py-0.5 text-[0.75rem] font-extrabold uppercase tracking-[0.06em]", row.chip, row.tone)}>
                {row.label}
              </span>
              <span>
                {blankBefore}
                <strong className={cn("rounded-md px-1.5", row.chip, row.tone, row.strike && "line-through decoration-2")}>{row.fill}</strong>
                {blankAfter.join("___")}
              </span>
            </p>
          ))}
        </div>
      ) : null}
      {question.explain_id ? (
        <div className="rounded-[16px] bg-canvas px-5 py-[18px]">
          <strong className="mb-1.5 block font-display text-[1.0625rem]">Pembahasan</strong>
          <p className="text-[1rem] leading-[1.65] text-ink-muted">{question.explain_id}</p>
        </div>
      ) : null}
      {question.audio ? (
        <div className="rounded-[16px] bg-sky-soft px-5 py-[18px]">
          <strong className="mb-2 block font-display text-[1.0625rem]">Transkrip</strong>
          <div className="flex flex-col gap-1.5 text-[1rem] leading-[1.6]">
            {question.audio.map((line, i) => (
              <p key={i}>
                <strong className="text-sky-deep">{SPEAKER[line.speaker]}:</strong> {line.text}
              </p>
            ))}
          </div>
        </div>
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
        "font-display font-medium",
        isWritten ? "text-[1.5rem] leading-[1.75] sm:text-[1.75rem]" : question.type === "structure" ? "text-[1.5rem] leading-[1.45] sm:text-[1.75rem]" : "text-[1.25rem] leading-[1.4] sm:text-[1.375rem]",
      )}
    >
      {isListening ? question.q : <Sentence question={question} revealed={revealed} filled={revealed && right} />}
    </h1>
  );

  const questionCard = (
    <section key={index} aria-labelledby="question-text" className={cn(CARD, "page-enter flex flex-col gap-6 p-5 sm:p-8")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.8125rem] font-semibold text-ink-subtle">
          Soal {index + 1} · {isListening ? "Pertanyaan narator" : (TYPE_LABEL[question.type] ?? "Soal")}
        </span>
        {TYPE_HINT[question.type] && !isListening ? (
          <span className="text-[0.8125rem] font-medium text-ink-subtle">{TYPE_HINT[question.type]}</span>
        ) : null}
        {question.skill && topicAcc !== undefined && topicAcc < 60 ? (
          <span className="rounded-full bg-brick-soft px-3 py-1 text-[0.8125rem] font-bold text-brick-deep">
            {SKILLS[question.skill].label} · akurasimu {topicAcc}%
          </span>
        ) : null}
      </div>
      {questionHeading}
      {showParaLink ? (
        <button type="button" className={cn(BTN_SOFT, "h-10 self-start text-[0.875rem]")} onClick={() => showParagraph(paraNo)}>
          <AlignLeft className="size-4" aria-hidden />
          Lihat paragraf {paraNo} di teks
        </button>
      ) : null}
      {options}
      {feedback}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline-soft pt-[18px]">
        {footerLeft}
        <div className="ml-auto flex flex-wrap gap-2.5">
          {canRevisit ? (
            <button type="button" className={FLAG_BTN} aria-pressed={flagOn} onClick={toggleFlag}>
              <Flag className="size-[18px]" aria-hidden />
              Ragu-ragu
            </button>
          ) : null}
          {primaryAction}
        </div>
      </div>
      {exam ? (
        <p className="-mt-3 text-[0.8125rem] font-medium text-ink-subtle">
          {hint} Benar/salah tidak ditampilkan sampai simulasi selesai.
        </p>
      ) : null}
    </section>
  );

  const audioCard = isListening ? (
    <section aria-labelledby="audio-title" className={cn(CARD, "flex flex-col gap-6 p-5 sm:p-8")}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <span className="text-[0.8125rem] font-semibold text-ink-subtle">{TYPE_LABEL.listening}</span>
          <h2 id="audio-title" className="font-display text-[1.375rem] font-bold leading-tight sm:text-[1.625rem]">
            {exam ? "Dengarkan percakapan berikut" : "Putar audio, lalu pilih jawaban"}
          </h2>
        </div>
        {exam ? (
          <span className="rounded-full bg-mango-soft px-3 py-1.5 text-[0.8125rem] font-bold text-mango-ink">Hanya diputar sekali</span>
        ) : (
          <span className="rounded-full bg-primary-soft px-3 py-1.5 text-[0.8125rem] font-bold text-primary-deep">Bisa diulang di mode latihan</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <span
          aria-hidden
          className={cn(
            "flex size-16 shrink-0 items-center justify-center rounded-full transition-colors",
            playing ? "bg-primary text-white" : "bg-primary-soft text-primary",
          )}
        >
          {loadingAudio ? <Loader2 className="size-7 animate-spin" /> : <Volume2 className="size-7" />}
        </span>
        <div aria-hidden className="flex h-[72px] min-w-[10rem] flex-[1_1_14rem] items-center justify-between gap-[3px]">
          {WAVE.map((height, i) => (
            <span
              key={i}
              className={cn("min-w-[3px] flex-1 rounded-[3px]", playing ? "wave-bar bg-primary" : "bg-hairline-strong")}
              style={{ height, animationDelay: `${-(i % 9) * 0.11}s` }}
            />
          ))}
        </div>
        <span
          role="timer"
          aria-label={`Lama audio ${formatClock(audSec * 1000)}`}
          className="tnum shrink-0 font-mono text-[0.9375rem] font-bold text-ink-subtle"
        >
          {formatClock(audSec * 1000)}
        </span>
      </div>

      {speaking ? (
        <p role="status" className="flex h-[52px] items-center gap-2.5 rounded-[14px] bg-surface-muted px-5 text-[1rem] font-bold">
          {loadingAudio ? "Memuat audio…" : "Sedang diputar"}
        </p>
      ) : (
        <button type="button" onClick={play} className={cn(BTN, "self-start")}>
          {!exam && heardIdx === index ? <RotateCcw className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
          {audioUsed ? "Dengar pertanyaan lagi" : !exam && heardIdx === index ? "Putar ulang" : "Putar audio"}
        </button>
      )}
      {!exam ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          {speaking ? (
            <button type="button" onClick={play} disabled={loadingAudio} className={cn(BTN_SOFT, "h-11")}>
              <RotateCcw className="size-4" aria-hidden />
              Putar ulang
            </button>
          ) : null}
          <div role="radiogroup" aria-label="Kecepatan audio" className="flex gap-1 rounded-[12px] bg-canvas p-[3px]">
            {SPEEDS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={speed === value}
                onClick={() => changeSpeed(value)}
                className={cn(
                  "h-11 min-w-14 cursor-pointer rounded-[10px] px-3 text-[0.8125rem] font-bold transition-colors motion-reduce:transition-none",
                  speed === value ? "bg-surface text-ink shadow-[0_1px_2px_rgba(40,30,10,0.12)]" : "text-ink-subtle hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[0.8125rem] font-medium text-ink-subtle">Kecepatan berlaku di putaran berikutnya.</span>
        </div>
      ) : null}
      <p className="text-[0.9375rem] text-ink-subtle">
        {silent
          ? "Browser tanpa suara. Transkrip ditampilkan."
          : exam
            ? audioUsed
              ? "Dialog sudah diputar. Pertanyaan bisa didengar ulang."
              : "Audio hanya diputar sekali, seperti tes asli."
            : revealed
              ? "Transkrip ada di bawah soal."
              : "Transkrip muncul setelah jawaban diperiksa."}
      </p>
      {silent ? (
        <div className="flex flex-col gap-1 rounded-[14px] bg-surface-muted p-4 leading-relaxed">
          {question.audio?.map((line, i) => (
            <p key={i}>
              <span className="font-bold">{SPEAKER[line.speaker]}:</span> {line.text}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  ) : null;

  const lockPanel = isListening ? (
    <aside aria-label="Progres Listening" className="flex flex-col gap-5">
      <section className={cn(CARD, "flex flex-col gap-4 p-5 sm:p-6")}>
        <h2 className="font-display text-[1.25rem] font-bold">Urutan soal terkunci</h2>
        <p className="text-[0.9375rem] leading-relaxed text-ink-subtle">
          {exam
            ? "Seperti tes asli, soal Listening tidak bisa dilewati atau dibuka kembali. Audio soal berikutnya langsung diputar setelah kamu lanjut."
            : "Soal Listening dikerjakan berurutan dan tidak bisa dibuka kembali."}
        </p>
        <div role="img" aria-label={`Soal ${index + 1} dari ${questions.length}`} className="flex gap-[3px]">
          {questions.map((_, n) => (
            <span
              key={n}
              className={cn("h-2 flex-1 rounded-full", n < index ? "bg-primary" : n === index ? "bg-charcoal" : "bg-hairline")}
            />
          ))}
        </div>
      </section>
      <section className={cn(CARD, "flex flex-col gap-2 p-5 sm:p-6")}>
        <h2 className="font-display text-[1.25rem] font-bold">Sudah dijawab</h2>
        <p>
          <strong className="tnum font-display text-[2.25rem] font-bold leading-none">{answeredCount}</strong>{" "}
          <span className="text-[0.8125rem] font-semibold text-ink-subtle">dari {questions.length} soal</span>
        </p>
      </section>
    </aside>
  ) : null;

  const passageCard = session.passage && !isListening ? (
    <article
      aria-label="Teks bacaan"
      className={cn(CARD, "flex flex-col gap-4 self-start p-5 sm:px-9 sm:py-8 lg:sticky lg:top-24")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.8125rem] font-semibold text-ink-subtle">Teks bacaan</span>
        <div role="group" aria-label="Ukuran teks" className="flex gap-1.5">
          <button
            type="button"
            aria-label="Perkecil teks bacaan"
            disabled={textSize === 0}
            onClick={() => changeTextSize(-1)}
            className="size-11 cursor-pointer rounded-[10px] border-[1.5px] border-hairline-strong bg-surface font-display text-[0.875rem] font-extrabold disabled:opacity-40"
          >
            A−
          </button>
          <button
            type="button"
            aria-label="Perbesar teks bacaan"
            disabled={textSize === TEXT_SIZES.length - 1}
            onClick={() => changeTextSize(1)}
            className="size-11 cursor-pointer rounded-[10px] border-[1.5px] border-hairline-strong bg-surface font-display text-[1rem] font-extrabold disabled:opacity-40"
          >
            A+
          </button>
        </div>
      </div>
      <div
        className={cn(
          "grid max-h-[62dvh] max-w-[68ch] grid-cols-[1.5rem_minmax(0,1fr)] content-start gap-x-3.5 gap-y-4 overflow-y-auto leading-[1.8] text-ink-muted",
          TEXT_SIZES[textSize],
        )}
      >
        {paragraphs
          .map((paragraph, i) => (
            <div key={i} className="contents">
              <span aria-hidden className="tnum pt-1.5 font-mono text-[0.75rem] text-ink-faint">
                {i + 1}
              </span>
              <p id={`para-${i + 1}`} tabIndex={-1} className="rounded-[8px] outline-none transition-colors focus:bg-mango-soft motion-reduce:transition-none">
                <span className="sr-only">Paragraf {i + 1}. </span>
                {parseInline(paragraph.trim()).map((span, j) =>
                  span.tone === "bold" ? (
                    <strong key={j} className="rounded bg-mango-mark px-0.5 font-bold text-ink">
                      {span.text}
                    </strong>
                  ) : (
                    span.text
                  ),
                )}
              </p>
            </div>
          ))}
      </div>
    </article>
  ) : null;

  const errorLine =
    !revealed && error ? (
      <p role="alert" className="text-[0.9375rem] font-bold text-brick-deep">
        {error}
      </p>
    ) : null;

  const withPassage = Boolean(passageCard);
  const hasAside = isListening || (!withPassage && showNav);

  const body = (askOpen: boolean, trigger?: React.ReactNode, inlinePanel?: React.ReactNode) => {
    const squeezed = askOpen && !withPassage;
    return shell(
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-8">
        <div
          className={cn(
            "grid gap-6 lg:gap-7",
            // Panel AI di sisi kanan (dock) terbuka = ruang sempit: tumpuk semuanya.
            // Di Reading AI ada di bawah soal, jadi susunan teks + soal tidak berubah.
            !squeezed && withPassage && "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]",
            !squeezed && !withPassage && hasAside && "lg:grid-cols-[minmax(0,1fr)_340px]",
            !hasAside && !withPassage && "mx-auto w-full max-w-[860px]",
          )}
        >
          {passageCard}
          <div className="flex min-w-0 flex-col gap-5">
            {audioCard}
            {questionCard}
            {errorLine}
            {inlinePanel}
            {withPassage ? navPanel : null}
          </div>
          {isListening ? lockPanel : !withPassage && navPanel ? <div className="lg:sticky lg:top-24 lg:self-start">{navPanel}</div> : null}
        </div>
      </main>,
      trigger,
    );
  };

  // Mode ujian: render tanpa pembungkus AskAi — trigger "Tanya AI" tidak boleh muncul.
  if (exam) return body(false);

  return (
    <AskAi
      section={session.section}
      revealed={revealed}
      placement={withPassage ? "inline" : "dock"}
      context={[
        session.passage ? `Teks bacaan:\n${session.passage}` : "",
        // Transkrip audio hanya dikirim setelah jawaban diperiksa (bukan saat ujian).
        revealed && question.audio
          ? `Transkrip:\n${question.audio.map((line) => `${line.speaker}: ${line.text}`).join("\n")}`
          : question.audio
            ? "Ini soal Listening dan kamu tidak punya transkrip audionya. Jangan menebak isi rekaman; beri strategi mendengar saja."
            : "",
        revealed ? "STATUS: SUDAH DIJAWAB" : "STATUS: BELUM DIJAWAB",
        `Soal (${session.section}): ${question.q}`,
        ...question.options.map((option, i) => `${LETTERS[i]}. ${option}`),
      ]
        .filter(Boolean)
        .join("\n")}
    >
      {(askOpen, trigger, inlinePanel) => body(askOpen, trigger, inlinePanel)}
    </AskAi>
  );
}
