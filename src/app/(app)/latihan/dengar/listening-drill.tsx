"use client";

import { Check, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DrillFooter, DrillHeader, DrillMain, DrillPage, FeedbackBar, PrimaryButton } from "@/components/drill/parts";
import { DrillSummary } from "@/components/drill/summary";
import { Lori } from "@/components/mascot";
import { sfx } from "@/lib/sfx";
import { DEFAULT_PREFS, speakLines } from "@/lib/voices";
import { cn } from "@/lib/utils";

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
      <mark className="rounded-[4px] bg-[#f2c878] px-1">{sentence.slice(at, at + word.length)}</mark>
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
      const result = await finishDrillAction("listening", correct, items.length);
      if (result.xp) setXp(result.xp);
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
          <Link href="/latihan" className="font-extrabold text-primary hover:underline">
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
        subtitle={`${correct} dari ${items.length} kalimat berhasil kamu tangkap.`}
        onAgain={again}
        stats={[
          { label: "BENAR", value: `${correct}/${items.length}`, bg: "bg-primary", ink: "text-primary-deep" },
          { label: "AKURASI", value: `${Math.round((correct / items.length) * 100)}%`, bg: "bg-[#8c5bb5]", ink: "text-[#5d2e86]" },
          { label: "TOTAL XP", value: xp, bg: "bg-mango", ink: "text-[#a86a12]" },
          { label: "KALIMAT", value: items.length, bg: "bg-sky", ink: "text-sky-deep" },
        ]}
      />
    );
  }

  // Tinggi dasar gelombang bervariasi simetris-acak (bukan menurun satu arah).
  const bars = Array.from({ length: 36 }, (_, i) => 22 + Math.round(68 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37 + 0.6))));

  return (
    <DrillPage>
      <DrillHeader
        exitHref="/latihan"
        value={index + (checked ? 1 : 0)}
        max={items.length}
        barClass="bg-[#8c5bb5] shadow-[inset_0_-5px_0_#5d2e86]"
      />
      <DrillMain className="flex flex-wrap items-start gap-10">
        <section aria-label="Audio" className="flex w-full flex-col gap-4 lg:w-[440px] lg:shrink-0">
          <h1 className="rise font-display text-[2rem] font-black tracking-[-0.02em]">Dengarkan, lalu jawab</h1>
          <div className="rise relative overflow-hidden rounded-[28px] bg-[#2e2340] p-6 text-canvas shadow-[0_6px_0_#1b1428] [--i:1]">
            <div className="relative flex h-[210px] justify-center">
              {playing ? (
                <>
                  <span aria-hidden className="float absolute left-[60%] top-10 font-display text-[1.625rem] font-black text-[#d5bfe6]">♪</span>
                  <span aria-hidden className="float absolute left-[30%] top-[60px] font-display text-[1.375rem] font-black text-[#f2c878] [animation-delay:-1s]">♫</span>
                </>
              ) : null}
              <Lori mood={playing ? "talk" : "idle"} size={210} label="Lori mendengarkan bersamamu" />
            </div>
            <div aria-hidden className="mt-1 flex h-12 items-center gap-[3px]">
              {bars.map((h, i) => (
                <span
                  key={i}
                  className={cn("flex-1 rounded-[3px] bg-[#d5bfe6]", playing && "wave-bar")}
                  style={{ height: `${h}%`, animationDelay: `${((i * 7) % 11) * 0.09}s`, opacity: playing ? 1 : 0.5 }}
                />
              ))}
            </div>
            <div className="mt-4 flex min-h-[100px] flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={play}
                disabled={!supported || playing || plays >= MAX_PLAYS}
                aria-label={plays >= MAX_PLAYS ? "Audio sudah diputar dua kali" : "Putar audio"}
                className="ledge relative grid size-[72px] shrink-0 cursor-pointer place-items-center rounded-full bg-[#f2c878] text-[#2e2340] [--ledge:#c4831f] disabled:cursor-default disabled:opacity-60"
              >
                {playing ? <Pause className="size-8 fill-current" aria-hidden /> : <Play className="size-8 fill-current" aria-hidden />}
                {playing ? <span aria-hidden className="ping absolute inset-0 rounded-full border-4 border-[#f2c878]" /> : null}
              </button>
              <div className="min-w-[140px] flex-1">
                <p className="font-display text-[1.125rem] font-black">
                  {!supported ? "Suara tidak didukung" : playing ? "Memutar…" : plays >= MAX_PLAYS ? "Putaran habis" : "Tekan untuk mendengar"}
                </p>
                <p className="mt-0.5 text-[0.875rem] text-[#d5bfe6]">
                  Audio boleh diputar {MAX_PLAYS} kali ({MAX_PLAYS - plays} tersisa)
                </p>
              </div>
              <div role="radiogroup" aria-label="Kecepatan" className="flex w-full rounded-[12px] bg-[#1b1428] p-1 sm:w-auto">
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
                      "min-h-10 min-w-[52px] cursor-pointer rounded-[9px] text-[0.875rem] font-extrabold",
                      slow === s.slow ? "bg-[#f2c878] text-[#2e2340]" : "text-[#d5bfe6]",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Pertanyaan" className="flex min-w-0 flex-1 flex-col gap-4 lg:basis-[460px] lg:pt-14">
          <p className="rise inline-flex self-start rounded-[10px] bg-[#f1e8f7] px-3 py-1.5 text-[0.8125rem] font-extrabold tracking-[0.06em] text-[#5d2e86]">
            DENGAR KATA · KALIMAT {index + 1}
          </p>
          <h2 className="rise font-display text-[1.75rem] font-extrabold leading-snug [--i:1]">
            Kata mana yang ada di kalimat tadi?
          </h2>
          <div role="radiogroup" aria-label="Pilihan jawaban" className={cn("flex flex-col gap-3", checked && !right && "shake")}>
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
                    "rise flex min-h-16 cursor-pointer items-center gap-3.5 rounded-[18px] border-2 px-[18px] py-3 text-left text-[1.125rem] font-bold shadow-[0_4px_0_var(--color-hairline)] transition-[transform,box-shadow] active:translate-y-1 active:shadow-none disabled:cursor-default",
                    !checked && chosen && "border-[#8c5bb5] bg-[#f1e8f7] shadow-[0_4px_0_#8c5bb5]",
                    !checked && !chosen && "border-hairline bg-surface hover:border-[#8c5bb5]",
                    isAnswer && "border-primary bg-primary-soft shadow-[0_4px_0_var(--color-primary)]",
                    checked && chosen && !isAnswer && "border-brick bg-brick-soft shadow-[0_4px_0_var(--color-brick)]",
                    checked && !chosen && !isAnswer && "border-hairline bg-surface opacity-60",
                  )}
                  style={{ "--i": i + 2 } as React.CSSProperties}
                >
                  <span aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-[10px] border-2 border-current font-display text-[1rem] font-extrabold">
                    {isAnswer ? <Check className="size-4" strokeWidth={3} /> : String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>

          {checked ? (
            <div className="pop rounded-[20px] border-2 border-dashed border-[#d5bfe6] bg-surface px-5 py-[18px]">
              <p className="mb-2.5 text-[0.8125rem] font-extrabold tracking-[0.08em] text-[#5d2e86]">TRANSKRIP</p>
              <p className="text-[1.0625rem] leading-relaxed">{highlight(item.sentence, item.answer)}</p>
              {item.translation ? <p className="mt-1.5 text-[0.9375rem] text-ink-subtle">{item.translation}</p> : null}
              <p className="mt-3 text-[0.9375rem] text-ink-muted">
                <strong className="text-ink">{item.answer}</strong> = {item.meaning}
              </p>
            </div>
          ) : null}
        </section>
      </DrillMain>

      {checked ? (
        <FeedbackBar
          tone={right ? "right" : "wrong"}
          title={right ? "Tepat!" : "Hampir!"}
          body={right ? `“${item.answer}” memang ada di kalimat itu.` : `Jawaban yang benar: ${item.answer}`}
        >
          <PrimaryButton onClick={next} autoFocus className={right ? undefined : "bg-brick [--ledge:var(--color-brick-deep)]"}>
            {index + 1 < items.length ? "LANJUT" : "SELESAI"}
          </PrimaryButton>
        </FeedbackBar>
      ) : (
        <DrillFooter>
          <Link href="/latihan" className="flex min-h-11 items-center font-extrabold text-ink-subtle hover:text-ink">
            NGGAK BISA DENGAR SEKARANG
          </Link>
          <PrimaryButton
            onClick={check}
            disabled={!picked}
            className={picked ? undefined : "bg-hairline text-[#6a6f73] [--ledge:transparent]"}
          >
            PERIKSA
          </PrimaryButton>
        </DrillFooter>
      )}
    </DrillPage>
  );
}
