"use client";

import { Mic, Square, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  DrillFooter,
  DrillHeader,
  DrillMain,
  DrillPage,
  PrimaryButton,
  SecondaryButton,
} from "@/components/drill/parts";
import { DrillSummary } from "@/components/drill/summary";
import { Lori } from "@/components/mascot";
import { SpeechBubble } from "@/components/ui/bubble";
import { sfx } from "@/lib/sfx";
import { DEFAULT_PREFS, speakLines } from "@/lib/voices";
import { cn } from "@/lib/utils";

import { finishDrillAction } from "../actions";

export type SpeakingItem = {
  id: number;
  sentence: string;
  translation: string | null;
  focus: string;
  phonetic: string | null;
};

/** Bagian minimal Web Speech API yang dipakai (belum ada di tipe DOM standar). */
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

/** Pesan per kode galat Web Speech API supaya pengguna tahu penyebab sebenarnya. */
const RECOGNITION_ERRORS: Record<string, string> = {
  "no-speech": "Suaramu tidak terdengar. Coba lagi lebih dekat ke mikrofon.",
  "audio-capture": "Mikrofon tidak ditemukan. Cek apakah mikrofon terpasang.",
  "not-allowed": "Izin mikrofon ditolak. Aktifkan di pengaturan situs browser.",
  "service-not-allowed": "Browser ini menolak layanan pengenalan suara. Coba Chrome atau Edge.",
  network: "Layanan pengenalan suara tidak bisa dihubungi. Di Brave layanan ini diblokir, coba Chrome atau Edge.",
  "language-not-supported": "Bahasa Inggris belum didukung pengenalan suara di browser ini.",
};

const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);

/** Cocokkan kata target dengan transkrip (tanpa urutan ketat, tiap kata dihitung sekali). */
function grade(sentence: string, heard: string) {
  const bag = norm(heard);
  const words = sentence.split(/\s+/).filter(Boolean).map((raw) => {
    const key = norm(raw)[0] ?? "";
    const at = key ? bag.indexOf(key) : -1;
    if (at >= 0) bag.splice(at, 1);
    return { raw, ok: at >= 0 || !key };
  });
  const ok = words.filter((w) => w.ok).length;
  return { words, score: words.length ? Math.round((ok / words.length) * 100) : 0 };
}

type Phase = "idle" | "recording" | "result";

export function SpeakingDrill({
  items,
  context,
  topicId,
  onRestart,
}: {
  items: SpeakingItem[];
  /** Judul topik bank prompt, ditampilkan di atas instruksi. */
  context?: string;
  /** Id topik katalog; kalau ada, skor terbaik topik ini ikut disimpan. */
  topicId?: string;
  onRestart?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [xp, setXp] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const rec = useRef<Recognition | null>(null);
  const saved = useRef(false);

  const item = items[index];
  const result = phase === "result" && item ? grade(item.sentence, heard) : null;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    // Brave menyediakan API-nya tetapi memblokir layanan suaranya, jadi dianggap tidak didukung.
    const isBrave = "brave" in navigator;
    setSupported(!isBrave && Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
    return () => rec.current?.stop();
  }, []);

  function listen() {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    let text = "";
    r.onresult = (event) => {
      text = Array.from(event.results)
        .map((alt) => alt[0]?.transcript ?? "")
        .join(" ");
    };
    r.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(RECOGNITION_ERRORS[event.error] ?? `Pengenalan suara gagal (${event.error}). Coba lagi atau lewati.`);
      setPhase("idle");
    };
    r.onend = () => {
      rec.current = null;
      if (text.trim()) {
        setHeard(text);
        setPhase("result");
      } else {
        setPhase((p) => (p === "recording" ? "idle" : p));
      }
    };
    rec.current = r;
    setPhase("recording");
    r.start();
  }

  function toggle() {
    if (phase === "recording") rec.current?.stop();
    else listen();
  }

  async function next() {
    const score = result?.score ?? 0;
    const all = [...scores, score];
    setScores(all);
    sfx.tap();
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setPhase("idle");
      setHeard("");
      return;
    }
    setDone(true);
    sfx.levelUp();
    if (!saved.current) {
      saved.current = true;
      const avg = Math.round(all.reduce((a, b) => a + b, 0) / all.length);
      const res = await finishDrillAction("speaking", avg, 100, topicId);
      if (res.xp) setXp(res.xp);
    }
  }

  function playModel() {
    speakLines([{ speaker: "woman", text: item.sentence }], DEFAULT_PREFS);
  }

  if (items.length === 0) {
    return (
      <DrillPage>
        <DrillHeader exitHref="/latihan" value={0} max={1} />
        <DrillMain className="flex flex-col items-center gap-4 pt-16 text-center">
          <Lori mood="think" size={160} />
          <h1 className="font-display text-[1.875rem] font-black">Belum ada kalimat untuk diucapkan</h1>
          <Link href="/latihan" className="font-extrabold text-primary hover:underline">
            Kembali ke Latihan
          </Link>
        </DrillMain>
      </DrillPage>
    );
  }

  if (done) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
    return (
      <DrillSummary
        title="Suaramu makin jelas!"
        subtitle={`Rata-rata skor pelafalan ${avg}.`}
        onAgain={onRestart ?? (() => window.location.reload())}
        stats={[
          { label: "SKOR", value: avg, bg: "bg-sky", ink: "text-sky-deep" },
          { label: "TERBAIK", value: Math.max(...scores, 0), bg: "bg-primary", ink: "text-primary-deep" },
          { label: "TOTAL XP", value: xp, bg: "bg-mango", ink: "text-mango-ink" },
        ]}
      />
    );
  }

  const verdict = result
    ? result.score >= 80
      ? { text: "Jelas dimengerti!", mood: "cheer" as const }
      : result.score >= 50
        ? { text: "Hampir, ulangi bagian yang merah.", mood: "talk" as const }
        : { text: "Belum terbaca. Coba lebih pelan.", mood: "think" as const }
    : null;
  const words = result?.words ?? item.sentence.split(/\s+/).map((raw) => ({ raw, ok: null as boolean | null }));

  return (
    <DrillPage>
      <DrillHeader
        exitHref="/latihan"
        value={index + (phase === "result" ? 1 : 0)}
        max={items.length}
        xp={xp || undefined}
      />
      <DrillMain className="flex flex-col items-center gap-7">
        {context ? (
          <p className="rise -mb-3 text-center text-[0.75rem] font-extrabold uppercase tracking-[0.08em] text-ink-subtle">
            {context}
          </p>
        ) : null}
        <h1 className="rise text-center font-display text-[1.75rem] font-black tracking-[-0.02em]">Ucapkan kalimat ini</h1>

        <div className="rise flex w-full flex-col gap-4 rounded-hero border-2 border-hairline bg-surface px-6 py-6 shadow-card [--i:1] sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={playModel}
              aria-label="Dengarkan contoh"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[12px] bg-sky text-white shadow-[0_3px_0_var(--color-sky-deep)] transition-transform active:translate-y-[3px] active:shadow-none"
            >
              <Volume2 className="size-5" aria-hidden />
            </button>
            <span className="text-[0.875rem] font-bold text-ink-subtle">Dengar contoh dulu kalau ragu</span>
          </div>
          <p aria-live="polite" className="flex flex-wrap gap-x-2.5 gap-y-2 text-[1.625rem] font-semibold leading-[1.6] sm:text-[1.75rem]">
            {words.map((w, i) => (
              <span
                key={i}
                className={cn(
                  "transition-colors duration-200",
                  w.ok === true && "border-b-4 border-primary text-primary-deep",
                  w.ok === false && "rounded-[8px] border-b-4 border-dotted border-brick bg-brick-soft px-1.5 text-brick-deep",
                )}
              >
                {w.raw}
              </span>
            ))}
          </p>
          {item.translation ? <p className="text-[0.9375rem] text-ink-subtle">{item.translation}</p> : null}
          {result ? (
            <div className="flex flex-wrap gap-4 text-[0.8125rem] font-extrabold">
              <span className="inline-flex items-center gap-1.5 text-primary-deep">
                <span aria-hidden className="h-1 w-[18px] rounded-sm bg-primary" />
                terdengar jelas
              </span>
              <span className="inline-flex items-center gap-1.5 text-brick-deep">
                <span aria-hidden className="w-[18px] border-b-4 border-dotted border-brick" />
                belum terdengar
              </span>
            </div>
          ) : (
            <p className="text-[0.875rem] text-ink-subtle">
              Fokus kata <strong className="text-ink">“{item.focus}”</strong>
              {item.phonetic ? ` ${item.phonetic}` : ""}.
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            disabled={!supported}
            aria-pressed={phase === "recording"}
            aria-label={phase === "recording" ? "Berhenti merekam" : "Mulai merekam"}
            className={cn(
              "relative grid size-[104px] cursor-pointer place-items-center rounded-full text-white transition-transform active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-50",
              phase === "recording"
                ? "bg-brick shadow-[0_0_0_10px_var(--color-brick-soft),0_6px_0_10px_var(--color-brick-line)]"
                : "bg-sky shadow-[0_0_0_10px_var(--color-sky-soft),0_6px_0_10px_var(--color-sky-line)]",
            )}
          >
            {phase === "recording" ? <Square className="size-9 fill-current" aria-hidden /> : <Mic className="size-11" strokeWidth={2.2} aria-hidden />}
            {phase === "recording" ? <span aria-hidden className="ping absolute inset-0 rounded-full border-[5px] border-brick-line" /> : null}
          </button>
          {phase === "recording" ? (
            <div aria-hidden className="mt-3 flex h-8 w-[220px] items-center gap-1">
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="wave-bar h-full flex-1 rounded-[3px] bg-brick" style={{ animationDelay: `${(i % 7) * 0.12}s` }} />
              ))}
            </div>
          ) : null}
          <p role="status" className={cn("mt-3 text-center text-[0.9375rem] font-extrabold", phase === "recording" ? "text-brick-deep" : "text-ink-muted")}>
            {!supported
              ? "Browser ini belum mendukung pengenalan suara (Brave memblokirnya). Coba Chrome atau Edge, atau lewati."
              : phase === "recording"
                ? "Merekam… tekan lagi untuk selesai"
                : "Tekan mic, lalu ucapkan seluruh kalimat"}
          </p>
          {error ? (
            <p role="alert" className="rounded-[12px] bg-brick-soft px-3 py-2 text-[0.875rem] font-bold text-brick-deep">
              {error}
            </p>
          ) : null}
        </div>

        {phase === "result" && result ? (
          <div className="flex w-full items-end gap-2">
            <Lori mood={verdict?.mood ?? "talk"} size={88} label="Lori mendengarkan" className="shrink-0" />
            <SpeechBubble className="pop mb-7 flex-1">
              <strong className="block text-primary-deep">
                {verdict?.text} · skor {result.score}
              </strong>
              <span className="text-ink-muted">Terdengar: “{heard}”.</span>
              {result.words.some((w) => !w.ok) ? (
                <span className="mt-1 block text-ink-muted">
                  Ulangi bagian:{" "}
                  {result.words
                    .filter((w) => !w.ok)
                    .slice(0, 4)
                    .map((w) => w.raw)
                    .join(", ")}
                </span>
              ) : null}
            </SpeechBubble>
          </div>
        ) : null}
      </DrillMain>

      <DrillFooter>
        <button
          type="button"
          onClick={next}
          className="h-[54px] cursor-pointer rounded-[16px] border-2 border-hairline bg-surface px-[22px] font-display font-extrabold text-ink-muted shadow-[0_4px_0_var(--color-hairline)] transition-transform active:translate-y-1 active:shadow-none"
        >
          LEWATI (MIK MATI)
        </button>
        <div className="flex flex-wrap gap-3">
          {phase === "result" ? (
            <SecondaryButton
              onClick={() => {
                setPhase("idle");
                setHeard("");
              }}
            >
              ULANGI
            </SecondaryButton>
          ) : null}
          <PrimaryButton onClick={next} disabled={phase !== "result"} autoFocus={phase === "result"}>
            {index + 1 < items.length ? "LANJUT" : "SELESAI"}
          </PrimaryButton>
        </div>
      </DrillFooter>
    </DrillPage>
  );
}
