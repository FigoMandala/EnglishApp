"use client";

import { Check, Eye, Pause, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  DrillFooter,
  DrillHeader,
  DrillMain,
  DrillPage,
  FeedbackBar,
  PrimaryButton,
  SecondaryButton,
} from "@/components/drill/parts";
import { DrillSummary } from "@/components/drill/summary";
import { Lori } from "@/components/mascot";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { DEFAULT_PREFS, speakLines, stopSpeaking } from "@/lib/voices";

import { finishDrillAction } from "../actions";

export type ListeningItem = {
  id: number;
  sentence: string;
  translation: string | null;
  answer: string;
  meaning: string;
  options: string[];
};

const MAX_PLAYS = 2;

/** Cetak tebal kata target di dalam kalimat (untuk transkrip setelah dijawab). */
function highlight(sentence: string, word: string) {
  const at = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return sentence;
  return (
    <>
      {sentence.slice(0, at)}
      <mark className="rounded-[4px] bg-mango-mark px-1 font-bold text-ink">{sentence.slice(at, at + word.length)}</mark>
      {sentence.slice(at + word.length)}
    </>
  );
}

export function ListeningDrill({ items }: { items: ListeningItem[] }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [done, setDone] = useState(false);
  const [xp, setXp] = useState(0);
  const [supported, setSupported] = useState(true);
  const [saveFailed, setSaveFailed] = useState(false);
  const saved = useRef(false);

  const item = items[index];
  const right = checked && picked === item?.answer;

  useEffect(() => setSupported("speechSynthesis" in window), []);

  function play() {
    if (!item || playing || plays >= MAX_PLAYS) return;
    setPlays((n) => n + 1);
    setPlaying(true);
    speakLines(
      [{ speaker: "woman", text: item.sentence }],
      { ...DEFAULT_PREFS, rate: slow ? 0.75 : DEFAULT_PREFS.rate },
      () => setPlaying(false),
    );
  }

  function check() {
    if (!picked || checked) return;
    setChecked(true);
    if (picked === item.answer) {
      setCorrect((n) => n + 1);
      sfx.correct();
    } else {
      sfx.wrong();
    }
  }

  async function next() {
    // Hentikan audio soal sebelumnya agar tidak menumpuk di soal berikutnya.
    stopSpeaking();
    setPlaying(false);
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setPicked(null);
      setChecked(false);
      setPlays(0);
      return;
    }
    setDone(true);
    sfx.levelUp();
    if (!saved.current) {
      saved.current = true;
      try {
        const result = await finishDrillAction("listening", correct, items.length);
        if (result.xp) setXp(result.xp);
      } catch {
        setSaveFailed(true);
      }
    }
  }

  function again() {
    window.location.reload();
  }

  if (items.length === 0) {
    return (
      <DrillPage>
        <DrillHeader exitHref="/latihan" value={0} max={1} />
        <DrillMain className="flex flex-col items-center gap-4 pt-16 text-center">
          <Lori mood="think" size={160} />
          <h1 className="font-display text-[1.875rem] font-black">Belum ada kalimat untuk didengar</h1>
          <p className="max-w-md text-ink-subtle">Bank kosakata belum punya kalimat contoh. Isi dulu lewat panel admin.</p>
          <Link href="/latihan" className="font-extrabold text-primary-deep hover:underline">
            Kembali ke Latihan
          </Link>
        </DrillMain>
      </DrillPage>
    );
  }

  if (done) {
    return (
      <DrillSummary
        title="Telingamu makin tajam!"
        subtitle={`Dengar & jawab · ${correct} dari ${items.length} kalimat berhasil kamu tangkap.${saveFailed ? " XP gagal disimpan, coba muat ulang halaman." : ""}`}
        onAgain={again}
        stats={[
          { label: "TOTAL XP", value: xp, bg: "bg-mango", ink: "text-mango-ink" },
          { label: "AKURASI", value: `${Math.round((correct / items.length) * 100)}%`, bg: "bg-primary", ink: "text-primary-deep" },
          { label: "KALIMAT", value: `${correct}/${items.length}`, bg: "bg-sky", ink: "text-sky-deep" },
        ]}
      />
    );
  }

  // Tinggi dasar gelombang bervariasi simetris-acak (bukan menurun satu arah).
  const bars = Array.from({ length: 28 }, (_, i) => 26 + Math.round(70 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37 + 0.6))));
  const playedRatio = plays / MAX_PLAYS;

  return (
    <DrillPage>
      <DrillHeader
        exitHref="/latihan"
        value={index + (checked ? 1 : 0)}
        max={items.length}
        barClass="bg-sky shadow-[inset_0_-4px_0_rgba(0,0,0,0.12)]"
      />
      <DrillMain className="flex flex-col items-center gap-7">
        <h1 className="rise text-center font-display text-[1.75rem] font-black tracking-[-0.02em]">Dengarkan, lalu jawab</h1>

        <section
          aria-label="Audio"
          className="rise flex w-full flex-wrap items-center gap-6 rounded-hero border-2 border-hairline bg-surface p-6 shadow-card [--i:1] sm:p-7"
        >
          <button
            type="button"
            onClick={play}
            disabled={!supported || playing || plays >= MAX_PLAYS}
            aria-label={plays >= MAX_PLAYS ? "Audio sudah diputar dua kali" : "Putar audio"}
            className="relative grid size-24 shrink-0 cursor-pointer place-items-center rounded-full bg-sky text-white shadow-[0_0_0_8px_var(--color-sky-soft),0_6px_0_8px_var(--color-sky-line)] transition-transform active:translate-y-1 disabled:cursor-default disabled:opacity-60"
          >
            {playing ? <Pause className="size-10 fill-current" aria-hidden /> : <Volume2 className="size-10" strokeWidth={2.2} aria-hidden />}
            {playing ? <span aria-hidden className="ping absolute inset-0 rounded-full border-4 border-sky" /> : null}
          </button>
          <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3">
            <div aria-hidden className="flex h-11 items-center gap-1">
              {bars.map((h, i) => (
                <span
                  key={i}
                  className={cn("w-1.5 rounded-[3px]", i / bars.length < playedRatio ? "bg-sky" : "bg-sky-line", playing && "wave-bar")}
                  style={{ height: `${h}%`, animationDelay: `${((i * 7) % 11) * 0.09}s` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div role="radiogroup" aria-label="Kecepatan" className="flex gap-1 rounded-[12px] bg-canvas-deep p-1">
                {[
                  { label: "1×", slow: false },
                  { label: "0.75×", slow: true },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    role="radio"
                    aria-checked={slow === s.slow}
                    onClick={() => setSlow(s.slow)}
                    className={cn(
                      "h-11 min-w-[52px] cursor-pointer rounded-[9px] px-3 text-[0.875rem] font-extrabold",
                      slow === s.slow ? "bg-surface shadow-[0_2px_0_var(--color-hairline-strong)]" : "text-ink-muted",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="text-[0.875rem] font-bold text-ink-subtle">
                {!supported
                  ? "Browser tanpa suara"
                  : playing
                    ? "Memutar…"
                    : plays >= MAX_PLAYS
                      ? "Putaran habis"
                      : `Sisa ${MAX_PLAYS - plays} putaran`}
                {" · "}
                <span className="text-sky-deep">{slow ? "mode pelan, XP tetap penuh" : "kecepatan normal"}</span>
              </span>
            </div>
          </div>
          <Lori mood={playing ? "talk" : "think"} size={80} label="Lori mendengarkan bersamamu" className="shrink-0" />
        </section>

        <section aria-label="Pertanyaan" className="flex w-full flex-col gap-4">
          <p className="rise eyebrow text-sky-deep">Dengar kata · kalimat {index + 1}</p>
          <h2 className="rise font-display text-[1.5rem] font-extrabold leading-snug [--i:1]">Kata mana yang ada di kalimat tadi?</h2>
          <div role="radiogroup" aria-label="Pilihan jawaban" className={cn("grid gap-3 sm:grid-cols-2", checked && !right && "shake")}>
            {item.options.map((option, i) => {
              const chosen = picked === option;
              const isAnswer = checked && option === item.answer;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={checked}
                  onClick={() => {
                    setPicked(option);
                    sfx.tap();
                  }}
                  className={cn(
                    "flex min-h-16 cursor-pointer items-center gap-3.5 rounded-[18px] border-2 px-[18px] py-3 text-left text-[1.125rem] font-bold transition-[transform,translate,box-shadow] active:translate-y-1 active:shadow-none disabled:cursor-default",
                    !checked && chosen && "border-sky bg-sky-soft text-sky-deep shadow-[0_4px_0_var(--color-sky-line)]",
                    !checked && !chosen && "border-hairline bg-surface shadow-[0_4px_0_var(--color-hairline)] hover:border-sky-line",
                    isAnswer && "border-primary bg-primary-soft text-primary-deep shadow-[0_4px_0_var(--color-primary-line)]",
                    checked && chosen && !isAnswer && "border-brick bg-brick-soft text-brick-deep shadow-[0_4px_0_var(--color-brick-line)]",
                    checked && !chosen && !isAnswer && "border-hairline bg-surface-muted text-ink-faint",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-[9px] text-[0.875rem] font-extrabold",
                      isAnswer
                        ? "bg-primary text-white"
                        : chosen
                          ? checked
                            ? "bg-brick text-white"
                            : "bg-sky text-white"
                          : "border-2 border-hairline text-ink-subtle",
                    )}
                  >
                    {isAnswer ? <Check className="size-4" strokeWidth={3} /> : String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>

          {checked ? (
            <div className="pop rounded-plate border-2 border-dashed border-hairline-strong bg-surface-muted px-5 py-[18px]">
              <p className="eyebrow mb-2 text-ink-subtle">Transkrip</p>
              <p className="text-[1.0625rem] leading-relaxed">{highlight(item.sentence, item.answer)}</p>
              {item.translation ? <p className="mt-1.5 text-[0.9375rem] text-ink-subtle">{item.translation}</p> : null}
              <p className="mt-3 text-[0.9375rem] text-ink-muted">
                <strong className="text-ink">{item.answer}</strong> = {item.meaning}
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[0.875rem] text-ink-subtle">
              <Eye className="size-4" aria-hidden />
              Transkrip muncul setelah jawaban diperiksa.
            </p>
          )}
        </section>
      </DrillMain>

      {checked ? (
        <FeedbackBar
          tone={right ? "right" : "wrong"}
          title={right ? "Tepat!" : "Hampir!"}
          body={right ? `“${item.answer}” memang ada di kalimat itu.` : `Jawaban yang benar: ${item.answer}`}
        >
          <PrimaryButton
            onClick={next}
            autoFocus
            className={right ? undefined : "bg-brick shadow-[0_5px_0_var(--color-brick-deep)]"}
          >
            {index + 1 < items.length ? "LANJUT" : "SELESAI"}
          </PrimaryButton>
        </FeedbackBar>
      ) : (
        <DrillFooter>
          <SecondaryButton onClick={next}>LEWATI</SecondaryButton>
          <PrimaryButton onClick={check} disabled={!picked}>
            PERIKSA
          </PrimaryButton>
        </DrillFooter>
      )}
    </DrillPage>
  );
}
