"use client";

import { ArrowRight, Check, GraduationCap, Loader2, Timer, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { partBatches, SIM_PARTS } from "@/lib/eprt-simulation";
import { cn } from "@/lib/utils";
import { speakLines, stopSpeaking, type VoicePrefs } from "@/lib/voices";

import type { BriefData } from "./brief-data";
import { prepareBatch } from "./simulation-client";

const CARD = "rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(40,30,10,0.05),0_8px_28px_rgba(40,30,10,0.06)]";
const CAP = "text-[0.8125rem] font-semibold text-ink-subtle";
const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky";
const HEADER_FOCUS = "focus-visible:outline-mango-line";
const SAMPLE = "This is a sound check for the Listening section. If you can hear this clearly, you are ready to begin.";
const BAR_COLOR = { listening: "bg-sky", structure: "bg-primary", reading: "bg-mango" } as const;
// Tinggi batang equalizer (deterministik, aman untuk hydration).
const EQ = Array.from({ length: 16 }, (_, i) => 14 + Math.round(Math.abs(Math.sin(i * 1.3)) * 30));

type Phase = "intro" | "prep" | "count";

/**
 * Layar petunjuk sebelum section dibuka. Halaman ini tidak memulai timer server:
 * timer baru jalan saat halaman soal (?p=) dirender, setelah penyiapan dan hitung mundur.
 */
export function SectionBrief({
  simId,
  index,
  partNo,
  backHref,
  data,
  voice,
}: {
  simId: number;
  index: number;
  partNo: string;
  backHref: string;
  data: BriefData;
  voice: VoicePrefs;
}) {
  const router = useRouter();
  const listening = data.section === "listening";
  const batches = partBatches(SIM_PARTS[index]);
  const [checks, setChecks] = useState<boolean[]>(() => data.checks.map(() => false));
  const [phase, setPhase] = useState<Phase>("intro");
  const [done, setDone] = useState(0);
  const [count, setCount] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useState<"idle" | "loading" | "playing">("idle");
  const alive = useRef(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (phase !== "intro") dialogRef.current?.focus();
  }, [phase]);

  // Hitung mundur 3-2-1, lalu buka layar soal (di sinilah timer server dimulai).
  useEffect(() => {
    if (phase !== "count") return;
    if (count <= 0) {
      router.push(`/toefl/simulasi?id=${simId}&p=${index}`);
      return;
    }
    const timer = window.setTimeout(() => setCount((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, count, router, simId, index]);

  const toggle = (position: number, on: boolean) =>
    setChecks((prev) => prev.map((value, i) => (i === position ? on : value)));

  function testSound() {
    if (sound !== "idle") {
      stopSpeaking();
      setSound("idle");
      return;
    }
    setSound("loading");
    speakLines(
      [{ speaker: "woman", text: SAMPLE }],
      voice,
      () => alive.current && setSound("idle"),
      () => alive.current && setSound("playing"),
    );
    // Memutar contoh sudah cukup sebagai tes: item terakhir ("tes suara") ikut dicentang.
    toggle(data.checks.length - 1, true);
  }

  async function start() {
    stopSpeaking();
    setSound("idle");
    setError(null);
    setDone(0);
    setPhase("prep");
    for (const batch of batches) {
      const message = await prepareBatch(simId, index, batch.index);
      if (!alive.current) return;
      if (message) {
        setError(message);
        setPhase("intro");
        return;
      }
      setDone(batch.index + 1);
    }
    setCount(3);
    setPhase("count");
  }

  const part = SIM_PARTS[index];
  const stepLabel = (batch: { offset: number; count: number }) =>
    part.kind === "reading"
      ? "Teks bacaan dan soal"
      : `Soal ${part.first + batch.offset} sampai ${part.first + batch.offset + batch.count - 1}`;
  const ready = checks.filter(Boolean).length;
  const accent = BAR_COLOR[data.section];
  const meanPerText = data.unit === "teks" ? Math.round(data.minutes / data.groups.length) : null;

  return (
    <>
      <div inert={phase !== "intro"}>
        <header className="sticky top-0 z-30 bg-charcoal pt-[env(safe-area-inset-top)] text-charcoal-ink">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <span className="hidden items-center gap-2 text-[0.75rem] font-bold tracking-[0.08em] text-charcoal-muted md:flex">
              <GraduationCap className="size-[18px] text-mango-line" strokeWidth={2.2} aria-hidden />
              SIMULASI · MODE UJIAN
            </span>
            <strong className="min-w-0 flex-[1_1_9rem] truncate font-display text-[1.0625rem] font-bold">
              {data.fullTitle}
            </strong>
            <Link
              href={backHref}
              aria-label="Batal"
              className={cn(
                "flex h-11 items-center gap-2 rounded-[12px] border-[1.5px] border-white/20 px-3.5 text-[0.8125rem] font-bold transition-colors hover:bg-white/10",
                HEADER_FOCUS,
              )}
            >
              <X className="size-4" aria-hidden />
              <span className="hidden sm:inline">Batal</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-[1120px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
          <div className="page-enter grid items-start gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section aria-labelledby="sec-title" className={cn(CARD, "flex flex-col gap-8 p-5 sm:p-10")}>
              <div>
                <span className={CAP}>{partNo}</span>
                <h1
                  id="sec-title"
                  className="mb-2.5 mt-1.5 font-display text-[clamp(2.125rem,4.4vw,3.125rem)] font-bold leading-[1.04] tracking-[-0.03em]"
                >
                  {data.label}
                </h1>
                <p className="max-w-[32.5rem] text-[1.0625rem] leading-relaxed text-ink-muted">{data.lead}</p>
              </div>

              <dl className="grid grid-cols-3 gap-3">
                {[
                  [data.total, "soal"],
                  [data.minutes, "menit"],
                  [data.groups.length, data.unit],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-[16px] bg-canvas px-3.5 py-4 sm:px-[18px]">
                    <dd className="tnum font-display text-[2rem] font-bold leading-none tracking-[-0.03em]">{value}</dd>
                    <dt className={cn(CAP, "font-medium")}>{label}</dt>
                  </div>
                ))}
              </dl>

              <div>
                <p className={cn(CAP, "mb-2.5")}>
                  {meanPerText
                    ? `${data.groups.length} teks, sekitar ${meanPerText} menit untuk tiap teks`
                    : `${data.groups.length} bagian dalam section ini`}
                </p>
                <div
                  role="img"
                  aria-label={data.groups.map((group) => `${group.name} ${group.count} soal`).join(", ")}
                  className="flex gap-1.5"
                >
                  {data.groups.map((group, i) => (
                    <div key={group.name} className="min-w-0" style={{ flex: group.count }}>
                      <div
                        className={cn("h-3 rounded-full", accent)}
                        style={{ opacity: data.groups.length > 1 ? 1 - (i * 0.7) / (data.groups.length - 1) : 1 }}
                      />
                      <div className="mt-2 break-words text-[0.875rem] leading-snug">
                        <strong>{group.name}</strong>
                        <br />
                        <span className={cn(CAP, "font-medium")}>{group.count} soal</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-3.5 font-display text-[1.375rem] font-bold tracking-[-0.02em]">Petunjuk</h2>
                <ol className="flex flex-col gap-3.5">
                  {data.rules.map((rule, i) => (
                    <li key={rule} className="flex items-start gap-3.5">
                      <span
                        aria-hidden
                        className="tnum flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft font-mono text-[0.8125rem] font-bold text-primary-deep"
                      >
                        {i + 1}
                      </span>
                      <span className="pt-0.5 text-[1rem] leading-relaxed text-ink-muted">{rule}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <aside aria-label="Sebelum mulai" className="flex flex-col gap-5 lg:sticky lg:top-20">
              <section className={cn(CARD, "flex flex-col gap-4 p-5 sm:p-7")}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-[1.375rem] font-bold tracking-[-0.02em]">Sebelum mulai</h2>
                  <span role="status" className={cn(CAP, "tnum")}>
                    {ready} dari {checks.length} siap
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {data.checks.map((label, i) => (
                    <label
                      key={label}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-center gap-3.5 rounded-[14px] border-2 py-2 pl-2.5 pr-3.5 text-[1rem] font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sky",
                        checks[i] ? "border-primary bg-primary-soft" : "border-hairline bg-surface hover:border-primary-line",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checks[i]}
                        onChange={(event) => toggle(i, event.target.checked)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-[9px] border-2 text-white transition-colors",
                          checks[i] ? "border-primary bg-primary" : "border-hairline-strong bg-surface",
                        )}
                      >
                        {checks[i] ? <Check className="size-4" strokeWidth={3} /> : null}
                      </span>
                      {label}
                    </label>
                  ))}
                </div>

                {listening ? (
                  <div className="flex flex-col gap-3 rounded-[16px] bg-canvas p-4">
                    <div className="flex items-center gap-3.5">
                      <button
                        type="button"
                        onClick={testSound}
                        aria-pressed={sound !== "idle"}
                        className={cn(
                          "flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[14px] bg-surface px-4 text-[0.9375rem] font-bold shadow-[inset_0_0_0_1.5px_var(--color-hairline-strong)] transition-colors hover:bg-canvas",
                          FOCUS,
                        )}
                      >
                        {sound === "loading" ? (
                          <Loader2 className="size-[18px] animate-spin" aria-hidden />
                        ) : (
                          <Volume2 className="size-[18px]" aria-hidden />
                        )}
                        {sound === "idle" ? "Putar contoh suara" : "Hentikan"}
                      </button>
                      <div aria-hidden className="flex h-11 min-w-0 flex-1 items-center justify-between gap-[3px]">
                        {EQ.map((height, i) => (
                          <span
                            key={i}
                            className={cn(
                              "min-w-[3px] flex-1 rounded-[3px]",
                              sound === "playing" ? "wave-bar bg-primary" : "bg-hairline-strong",
                            )}
                            style={{ height, animationDelay: `${-(i % 7) * 0.12}s` }}
                          />
                        ))}
                      </div>
                    </div>
                    <p role="status" className="text-[0.875rem] leading-snug text-ink-subtle">
                      {sound === "loading"
                        ? "Memuat contoh suara…"
                        : sound === "playing"
                          ? "Sedang diputar."
                          : "Atur volume lewat perangkatmu, lalu putar contoh ini."}
                    </p>
                  </div>
                ) : null}
              </section>

              <section className={cn(CARD, "flex flex-col gap-4 p-5 sm:p-7")}>
                <button
                  type="button"
                  onClick={start}
                  className={cn(
                    "inline-flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-[16px] bg-primary px-8 font-display text-[1.0625rem] font-bold text-white shadow-[0_6px_16px_rgba(30,122,76,0.28)] transition-[background-color,transform] duration-150 hover:bg-primary-deep active:translate-y-px motion-reduce:transition-none",
                    FOCUS,
                  )}
                >
                  Mulai {data.label}
                  <ArrowRight className="size-5" aria-hidden />
                </button>
                {error ? (
                  <p role="alert" className="text-[0.9375rem] font-semibold text-negative">
                    {error}
                  </p>
                ) : null}
                <p className="flex gap-2.5 text-[0.875rem] leading-normal text-ink-subtle">
                  <Timer className="mt-0.5 size-[18px] shrink-0" aria-hidden />
                  <span>
                    Timer {data.minutes}:00 untuk seluruh section ini mulai berjalan saat soal pertama terbuka, setelah
                    hitung mundur, dan tetap berjalan walau halaman ditutup.
                  </span>
                </p>
              </section>
            </aside>
          </div>
        </main>
      </div>

      {phase !== "intro" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/55 p-5">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pp-title"
            aria-live="polite"
            tabIndex={-1}
            className="w-full max-w-[30rem] rounded-[24px] bg-surface px-6 py-10 text-center shadow-overlay focus:outline-none sm:px-8"
          >
            {phase === "prep" ? (
              <div className="flex flex-col items-center gap-5">
                <span
                  aria-hidden
                  className="size-16 animate-spin rounded-full border-[6px] border-primary-soft border-t-primary"
                />
                <div>
                  <h2 id="pp-title" className="mb-1.5 font-display text-[1.625rem] font-bold tracking-[-0.02em]">
                    Menyiapkan {data.label}
                  </h2>
                  <p className="text-[0.9375rem] text-ink-subtle">
                    {listening
                      ? "Audio dimuat dulu supaya tidak terputus saat soal berjalan."
                      : "Mohon tunggu, soal sedang disiapkan."}
                  </p>
                </div>
                <ul className="flex w-full flex-col gap-2.5 text-left">
                  {batches.map((batch) => {
                    const finished = batch.index < done;
                    return (
                      <li
                        key={batch.index}
                        className={cn(
                          "flex items-center gap-3 text-[1rem] font-semibold",
                          finished ? "text-ink" : "text-ink-subtle",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-[22px] shrink-0 items-center justify-center rounded-full text-white",
                            finished ? "bg-primary" : "bg-hairline-strong",
                          )}
                        >
                          {finished ? <Check className="size-[13px]" strokeWidth={3.4} /> : null}
                        </span>
                        {stepLabel(batch)}
                        <span className="sr-only">{finished ? " siap" : " menunggu"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <span className={CAP}>{data.label} dimulai dalam</span>
                <strong
                  id="pp-title"
                  className="tnum font-display text-[7.5rem] font-bold leading-none tracking-[-0.05em] text-primary"
                >
                  {Math.max(count, 1)}
                </strong>
                <p className="text-[0.9375rem] text-ink-subtle">Siapkan dirimu. Timer mulai saat soal pertama terbuka.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
