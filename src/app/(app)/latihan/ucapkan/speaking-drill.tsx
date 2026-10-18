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

export function SpeakingDrill({ items }: { items: SpeakingItem[] }) {
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
      const res = await finishDrillAction("speaking", avg, 100);
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
        onAgain={() => window.location.reload()}
        stats={[
          { label: "SKOR", value: avg, bg: "bg-sky", ink: "text-sky-deep" },
          { label: "KALIMAT", value: items.length, bg: "bg-primary", ink: "text-primary-deep" },
          { label: "TERBAIK", value: Math.max(...scores, 0), bg: "bg-[#8c5bb5]", ink: "text-[#5d2e86]" },
          { label: "TOTAL XP", value: xp, bg: "bg-mango", ink: "text-[#a86a12]" },
        ]}
      />
    );
  }

  const verdict = result
    ? result.score >= 80
      ? { text: "Jelas dimengerti!", mood: "cheer" as const }
      : result.score >= 50
        ? { text: "Hampir, ulangi bagian yang merah.", mood: "idle" as const }
        : { text: "Belum terbaca. Coba lebih pelan.", mood: "sad" as const }
    : null;

  return (
    <DrillPage>
      <DrillHeader
        exitHref="/latihan"
        value={index + (phase === "result" ? 1 : 0)}
        max={items.length}
        barClass="bg-sky shadow-[inset_0_-5px_0_var(--color-sky-deep)]"
      />
      <DrillMain className="flex flex-col items-center gap-6">
        <h1 className="rise font-display text-[2rem] font-black tracking-[-0.02em]">Ucapkan kalimat ini</h1>

        <div
          aria-live="polite"
          className="rise flex flex-wrap justify-center gap-x-3.5 gap-y-2.5 rounded-[24px] border-2 border-hairline bg-surface px-7 py-[22px] shadow-[0_5px_0_var(--color-hairline)] [--i:1]"
        >
          {(result?.words ?? item.sentence.split(/\s+/).map((raw) => ({ raw, ok: null as boolean | null }))).map((w, i) => (
            <span
              key={i}
              className={cn(
                "rounded-[12px] border-b-4 px-2.5 py-1.5 font-display text-[1.75rem] font-black sm:text-[2.125rem]",
                w.ok === null && "border-transparent",
                w.ok === true && "pop border-primary bg-primary-soft text-primary-deep",
                w.ok === false && "pop border-brick bg-brick-soft text-brick-deep",
              )}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {w.raw}
            </span>
          ))}
        </div>
        {item.translation ? <p className="-mt-3 text-[1.0625rem] text-ink-subtle">{item.translation}</p> : null}

        <div className="flex w-full flex-wrap items-stretch justify-center gap-7">
          <section aria-label="Lori" className="flex max-w-[420px] flex-1 basis-[340px] flex-col items-center gap-2">
            <div className="pop rounded-[18px] border-2 border-hairline bg-surface px-[18px] py-3.5 text-[1rem] font-semibold leading-snug shadow-[0_3px_0_var(--color-hairline)]">
              {verdict
                ? verdict.text
                : phase === "recording"
                  ? "Aku dengerin… ucapkan sekarang."
                  : `Tekan mic lalu ucapkan. Fokus kata “${item.focus}”${item.phonetic ? ` ${item.phonetic}` : ""}.`}
            </div>
            <Lori mood={verdict?.mood ?? (phase === "recording" ? "talk" : "wave")} size={190} label="Lori mendengarkan" />
          </section>

          <section
            aria-label="Rekam"
            className="flex max-w-[480px] flex-1 basis-[380px] flex-col items-center justify-center gap-4 rounded-[28px] border-2 border-hairline bg-surface p-6 shadow-[0_5px_0_var(--color-hairline)]"
          >
            {phase !== "result" ? (
              <>
                <button
                  type="button"
                  onClick={toggle}
                  disabled={!supported}
                  aria-label={phase === "recording" ? "Berhenti merekam" : "Mulai merekam"}
                  className={cn(
                    "ledge relative grid size-[120px] cursor-pointer place-items-center rounded-full text-white disabled:cursor-not-allowed disabled:opacity-50",
                    phase === "recording" ? "bg-brick [--ledge:var(--color-brick-deep)]" : "bg-sky [--ledge:var(--color-sky-deep)]",
                  )}
                >
                  {phase === "recording" ? <Square className="size-10 fill-current" aria-hidden /> : <Mic className="size-12" aria-hidden />}
                  {phase === "recording" ? <span aria-hidden className="ping absolute inset-0 rounded-full border-[5px] border-[#efb4a2]" /> : null}
                </button>
                <div aria-hidden className="flex h-10 w-[260px] items-center gap-1">
                  {Array.from({ length: 28 }, (_, i) => (
                    <span
                      key={i}
                      className={cn("h-full flex-1 rounded-[3px]", phase === "recording" ? "wave-bar bg-brick" : "scale-y-[0.2] bg-hairline-strong")}
                      style={{ animationDelay: `${(i % 7) * 0.12}s` }}
                    />
                  ))}
                </div>
                <p className="text-center text-[1rem] font-extrabold text-ink-subtle">
                  {!supported
                    ? "Browser ini belum mendukung pengenalan suara (Brave memblokirnya). Coba Chrome atau Edge, atau lewati."
                    : phase === "recording"
                      ? "Merekam… tekan lagi untuk selesai"
                      : "Tekan mic, lalu ucapkan seluruh kalimat"}
                </p>
                {error ? <p role="alert" className="rounded-[12px] bg-brick-soft px-3 py-2 text-[0.875rem] font-semibold text-brick-deep">{error}</p> : null}
              </>
            ) : result ? (
              <div className="pop flex w-full flex-col items-center gap-3">
                <p className="font-display text-[3.5rem] font-black leading-none text-sky-deep">{result.score}</p>
                <p className="font-display text-[1.375rem] font-black">{verdict?.text}</p>
                <p className="w-full rounded-[12px] bg-canvas px-3.5 py-2.5 text-[0.9375rem] text-ink-muted">
                  <strong className="text-ink">Terdengar:</strong> {heard}
                </p>
                {result.words.some((w) => !w.ok) ? (
                  <ul className="flex w-full flex-col gap-2">
                    {result.words.filter((w) => !w.ok).slice(0, 4).map((w, i) => (
                      <li key={i} className="flex items-center gap-2.5 rounded-[12px] bg-brick-soft px-3 py-2.5 text-[0.9375rem]">
                        <span className="font-display font-black text-brick-deep">{w.raw}</span>
                        <span className="text-ink-subtle">belum terdengar</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </DrillMain>

      <DrillFooter>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={playModel}
            className="ledge flex min-h-14 cursor-pointer items-center gap-2.5 rounded-[16px] bg-sky px-5 font-display text-[1rem] font-extrabold text-white [--ledge:var(--color-sky-deep)]"
          >
            <Volume2 className="size-5" aria-hidden />
            DENGARKAN CONTOH
          </button>
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
        </div>
        {phase === "result" ? (
          <PrimaryButton onClick={next} autoFocus>
            {index + 1 < items.length ? "LANJUT" : "SELESAI"}
          </PrimaryButton>
        ) : (
          <button
            type="button"
            onClick={next}
            className="flex min-h-11 cursor-pointer items-center font-extrabold text-ink-subtle hover:text-ink"
          >
            NGGAK BISA BICARA SEKARANG
          </button>
        )}
      </DrillFooter>
    </DrillPage>
  );
}
