"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { LessonBody } from "@/components/lesson-body";
import { Lori } from "@/components/mascot";
import { cn } from "@/lib/utils";

export type LessonSection = { title: string; body: string };
export type TocItem = { slug: string; title: string; completed: boolean };

const PRESS =
  "transition-[transform,box-shadow,filter] duration-150 hover:brightness-[1.03] active:translate-y-1 active:shadow-none disabled:cursor-default";

/**
 * Materi per langkah (satu bagian `##` = satu langkah) dengan Lori sebagai pemandu.
 * Langkah terakhir selalu latihan: `practice` berisi tombol mulai latihan.
 */
export function LessonStepper({
  eyebrow,
  title,
  summary,
  sections,
  exerciseCount,
  practice,
  toc,
  tocTitle,
  currentSlug,
  mastery,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LessonSection[];
  exerciseCount: number;
  practice: ReactNode;
  toc: TocItem[];
  tocTitle: string;
  currentSlug: string;
  mastery: { correct: number; total: number };
}) {
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");

  const steps = [...sections.map((s) => s.title), "Latihan"];
  const last = steps.length - 1;
  const onPractice = step === last;
  const bubble = onPractice
    ? exerciseCount > 0
      ? `Sekarang praktik! ${exerciseCount} soal, satu per satu. Kalau salah, aku jelaskan.`
      : "Latihan untuk materi ini belum tersedia."
    : step === 0
      ? summary
      : `Bagian ${step + 1} dari ${steps.length}. Baca pelan-pelan, ya.`;

  const items = toc.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()));
  const pct = mastery.total > 0 ? Math.round((mastery.correct / mastery.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-[18px]">
        <div className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.875rem] font-extrabold tracking-[0.08em] text-[#17603c]">{eyebrow}</p>
            <h1 className="mt-1 font-display text-[2rem] font-black tracking-[-0.03em] sm:text-[2.625rem]">{title}</h1>
          </div>
          <div role="tablist" aria-label="Langkah materi" className="flex flex-wrap gap-2">
            {steps.map((label, i) => {
              const sel = i === step;
              const doneStep = i < step;
              return (
                <button
                  key={label + i}
                  type="button"
                  role="tab"
                  aria-selected={sel}
                  onClick={() => setStep(i)}
                  className={cn(
                    PRESS,
                    "min-h-11 cursor-pointer rounded-[12px] border-2 px-3.5 text-[0.875rem] font-extrabold",
                    sel && "border-primary bg-primary text-white",
                    doneStep && "border-[#9fd0b3] bg-[#eaf5ee] text-primary-deep",
                    !sel && !doneStep && "border-hairline bg-surface text-ink-subtle",
                  )}
                >
                  {i + 1}. {label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          role="tabpanel"
          aria-live="polite"
          className="relative min-h-[520px] overflow-hidden rounded-[28px] border-2 border-hairline bg-surface p-6 shadow-[0_6px_0_var(--color-hairline)] sm:px-9 sm:pb-9 sm:pt-8"
        >
          <div className="flex items-start gap-5">
            <Lori mood={onPractice ? "cheer" : "talk"} size={112} className="shrink-0" />
            <div key={step} className="pop mt-4 flex-1 rounded-[6px_20px_20px_20px] bg-canvas px-5 py-4 text-[1.125rem] font-semibold leading-normal">
              {bubble}
            </div>
          </div>

          {onPractice ? (
            <div key="practice" className="rise mt-7">
              <h2 className="font-display text-[1.875rem] font-black">Coba sendiri</h2>
              <div className="mt-4">{practice}</div>
            </div>
          ) : (
            <div key={step} className="rise mt-7">
              <h2 className="font-display text-[1.875rem] font-black">{sections[step].title}</h2>
              <div className="mt-4 max-w-[720px] [&_li]:text-[1.0625rem] [&_p]:text-[1.125rem] [&_p]:leading-relaxed">
                <LessonBody body={sections[step].body} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className={`${PRESS} min-h-14 cursor-pointer rounded-[16px] border-2 border-hairline bg-surface px-6 font-display text-[1.0625rem] font-extrabold shadow-[0_4px_0_var(--color-hairline)] disabled:opacity-45`}
          >
            SEBELUMNYA
          </button>
          {onPractice ? null : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(last, s + 1))}
              className="ledge min-h-14 min-w-[220px] cursor-pointer rounded-[16px] bg-primary px-7 font-display text-[1.1875rem] font-extrabold tracking-[0.02em] text-white"
            >
              LANJUT
            </button>
          )}
        </div>
      </section>

      <aside aria-label="Daftar materi" className="flex w-full flex-col gap-3.5 lg:w-80 lg:shrink-0">
        <label className="relative block">
          <span className="sr-only">Cari materi</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari materi, mis. passive"
            className="min-h-12 w-full rounded-[14px] border-2 border-hairline bg-surface pl-10 pr-4 text-[1rem] text-ink"
          />
        </label>
        <div className="rounded-[22px] border-2 border-hairline bg-surface p-[18px] shadow-[0_4px_0_var(--color-hairline)]">
          <h2 className="mb-3 font-display text-[1.1875rem] font-black">{tocTitle}</h2>
          <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
            {items.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/materi/${t.slug}`}
                  aria-current={t.slug === currentSlug ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-[12px] px-2.5 text-[0.9375rem]",
                    t.slug === currentSlug ? "bg-[#eaf5ee] font-extrabold" : "font-semibold hover:bg-surface-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-3.5 shrink-0 rounded-full border-2",
                      t.completed ? "border-primary bg-primary" : t.slug === currentSlug ? "border-primary bg-white" : "border-hairline-strong bg-white",
                    )}
                  />
                  <span className="flex-1">{t.title}</span>
                  <span className="sr-only">{t.completed ? "selesai" : "belum selesai"}</span>
                </Link>
              </li>
            ))}
            {items.length === 0 ? <li className="px-2.5 py-2 text-[0.875rem] text-ink-subtle">Tidak ada yang cocok.</li> : null}
          </ul>
        </div>
        <div className="rounded-[22px] border-2 border-[#9fd0b3] bg-primary-soft p-[18px]">
          <p className="font-display text-[1.125rem] font-black text-primary-deep">Penguasaan topik</p>
          <div className="mt-2.5 h-3.5 overflow-hidden rounded-full bg-white">
            <div className="grow-x h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[0.875rem] text-primary-deep">
            {mastery.total > 0
              ? `${pct}% dari ${mastery.total} soal latihan benar. Jawab semua dengan benar untuk menandai materi selesai.`
              : "Belum ada soal yang dijawab."}
          </p>
        </div>
      </aside>
    </div>
  );
}
