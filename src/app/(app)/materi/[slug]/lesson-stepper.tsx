"use client";

import { Check, ChevronLeft, ChevronRight, List, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { LessonBody } from "@/components/lesson-body";
import { Lori } from "@/components/mascot";
import { SpeechBubble } from "@/components/ui/bubble";
import { cn } from "@/lib/utils";

import { markLessonDoneAction } from "../../belajar/actions";
import { LoriWidget } from "./lori-widget";


export type LessonSection = { title: string; body: string };
export type TocItem = { slug: string; title: string; completed: boolean };

const PRESS = "transition-[transform,translate,box-shadow,filter] duration-150 active:translate-y-[5px] active:shadow-none disabled:cursor-default";

/**
 * Materi per langkah (satu bagian `##` = satu langkah): bar langkah di atas kartu, isi satu kolom,
 * daftar materi di popover, tombol Tanya Lori melayang. Langkah terakhir selalu latihan.
 */
export function LessonStepper({
  lessonId,
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
  lessonId: number;
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
  const [listOpen, setListOpen] = useState(false);

  // Materi tanpa soal (practice null) tidak punya langkah "Latihan": daftar
  // langkah berakhir di bagian baca terakhir + tombol tandai selesai, bukan
  // jalan buntu di bubble "belum tersedia".
  const hasPractice = practice !== null;
  const steps = [...sections.map((s) => s.title), ...(hasPractice ? ["Latihan"] : [])];
  const last = steps.length - 1;
  const onPractice = hasPractice && step === last;
  const onLastRead = !hasPractice && step === last;
  const bubble = onPractice
    ? exerciseCount > 0
      ? `Sekarang praktik! ${exerciseCount} soal, satu per satu. Kalau salah, aku bedah kalimatnya.`
      : "Latihan untuk materi ini belum tersedia."
    : step === 0
      ? summary
      : `Bagian ${step + 1} dari ${steps.length}. Baca pelan-pelan, ya.`;

  // Lori diberi tahu materi dan langkah yang sedang dibaca. Di langkah latihan, soalnya belum dijawab: jangan bocorkan.
  const loriContext = onPractice
    ? `Materi: ${title}. Pengguna sedang di langkah latihan soal materi ini.\nSTATUS: BELUM DIJAWAB`
    : `Materi: ${title}\nLangkah ${step + 1}: ${sections[step].title}\n${sections[step].body.slice(0, 3000)}\nSTATUS: SUDAH DIJAWAB`;

  const items = toc.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()));
  const pct = mastery.total > 0 ? Math.round((mastery.correct / mastery.total) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5">
      {/* Atas: remah roti, penguasaan, dan daftar materi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Remah roti" className="flex items-center gap-2 text-[0.875rem] font-bold text-ink-subtle">
          <Link href="/materi" className="text-ink-muted hover:text-primary-deep hover:underline">
            Materi Structure
          </Link>
          <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
          <span aria-current="page">{title}</span>
        </nav>
        <div className="relative flex items-center gap-2">
          <span
            title={mastery.total > 0 ? `${mastery.correct} dari ${mastery.total} soal benar` : "Belum ada soal yang dijawab"}
            className="flex h-10 items-center gap-2 rounded-full border-2 border-hairline bg-surface px-3.5 text-[0.8125rem] font-extrabold"
          >
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-canvas-deep">
              <span className={cn("block h-full", pct >= 75 ? "bg-primary" : pct >= 50 ? "bg-mango" : "bg-brick")} style={{ width: `${pct}%` }} />
            </span>
            {pct}%
          </span>
          <button
            type="button"
            aria-expanded={listOpen}
            aria-haspopup="dialog"
            onClick={() => setListOpen((open) => !open)}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full border-2 border-hairline bg-surface px-3.5 text-[0.8125rem] font-extrabold shadow-[0_3px_0_var(--color-hairline)]"
          >
            <List className="size-4" strokeWidth={2.4} aria-hidden />
            Daftar materi
          </button>
          {listOpen ? (
            <>
              <button type="button" aria-label="Tutup daftar materi" tabIndex={-1} onClick={() => setListOpen(false)} className="fixed inset-0 z-40 cursor-default" />
              <div
                role="dialog"
                aria-label={tocTitle}
                onKeyDown={(event) => event.key === "Escape" && setListOpen(false)}
                className="absolute right-0 top-12 z-50 flex w-[320px] max-w-[88vw] flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-4 shadow-card"
              >
                <label className="relative block">
                  <span className="sr-only">Cari materi</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                  <input
                    autoFocus
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari materi…"
                    className="h-11 w-full rounded-[12px] border-2 border-hairline bg-surface-muted pl-10 pr-3 text-[0.9375rem] focus:border-primary focus:outline-none"
                  />
                </label>
                <ul className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto pr-1 [contain:paint]">
                  {items.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={`/materi/${t.slug}`}
                        aria-current={t.slug === currentSlug ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-[12px] px-2 py-2 text-[0.875rem] leading-snug",
                          t.slug === currentSlug ? "bg-primary-soft font-extrabold text-primary-deep" : "font-semibold hover:bg-surface-muted",
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
                  {items.length === 0 ? <li className="px-2 py-2 text-[0.875rem] text-ink-subtle">Tidak ada yang cocok.</li> : null}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <article className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-6 rounded-hero border-2 border-hairline bg-surface p-5 shadow-card sm:p-8">
          {/* Progres langkah: tiap segmen bisa diklik */}
          <div className="flex flex-col gap-3">
            <div role="group" aria-label="Langkah materi" className="flex gap-1.5">
              {steps.map((label, i) => (
                <button
                  key={label + i}
                  type="button"
                  title={label}
                  aria-label={`Langkah ${i + 1}: ${label}`}
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => setStep(i)}
                  className="group flex h-7 flex-1 cursor-pointer items-center"
                >
                  <span
                    className={cn(
                      "h-2.5 w-full rounded-full transition-colors",
                      i < step ? "bg-primary" : i === step ? "bg-primary ring-4 ring-primary-soft" : "bg-canvas-deep group-hover:bg-hairline-strong",
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="eyebrow text-primary-deep">
                {eyebrow} · Langkah {step + 1} dari {steps.length}
              </span>
              <h1 className="font-display text-[1.875rem] font-black leading-[1.15] tracking-[-0.02em] sm:text-[2.125rem]">
                {onPractice ? "Coba sendiri" : sections[step].title}
              </h1>
            </div>
          </div>

          {step === 0 || onPractice ? (
            <div className="flex items-end gap-2">
              <Lori mood={onPractice ? "cheer" : "talk"} size={72} className="shrink-0" />
              <SpeechBubble who="Lori" className="pop mb-5 flex-1" key={step}>
                {bubble}
              </SpeechBubble>
            </div>
          ) : null}

          {onPractice ? (
            <div key="practice" className="rise">
              {practice}
            </div>
          ) : (
            <div
              key={step}
              className="pop-in [&_li]:text-[1.0625rem] [&_p]:max-w-[68ch] [&_p]:text-[1.0625rem] [&_p]:leading-relaxed [&_ol]:max-w-[68ch] [&_ul]:max-w-[68ch]"
            >
              <LessonBody body={sections[step].body} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className={`${PRESS} flex h-[52px] cursor-pointer items-center gap-2 rounded-[16px] border-2 border-hairline bg-surface px-5 font-display text-[0.9375rem] font-extrabold shadow-[0_4px_0_var(--color-hairline)] disabled:opacity-45`}
          >
            <ChevronLeft className="size-[18px]" strokeWidth={2.6} aria-hidden />
            {step > 0 ? steps[step - 1] : "Sebelumnya"}
          </button>
          {step === last ? (
            onLastRead ? (
              <MarkLessonDoneButton lessonId={lessonId} />
            ) : null
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(last, s + 1))}
              className={`${PRESS} flex h-[52px] cursor-pointer items-center gap-2 rounded-[16px] bg-primary px-6 font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.03em] text-white shadow-[0_5px_0_var(--color-primary-deep)]`}
            >
              Lanjut: {steps[step + 1]}
              <ChevronRight className="size-[18px]" strokeWidth={2.6} aria-hidden />
            </button>
          )}
        </div>
      </article>

      {/* Tombol melayang: tanya Lori, mengembang jadi obrolan di tempat */}
      <LoriWidget context={loriContext} />
    </div>
  );
}

/** Tombol tandai materi selesai untuk materi tanpa soal — satu-satunya jalan keluar dari langkah terakhir. */
function MarkLessonDoneButton({ lessonId }: { lessonId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <span className="pop flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2.5 text-[0.875rem] font-extrabold text-primary-deep">
        <Check className="size-4" strokeWidth={3.2} aria-hidden />
        Materi selesai
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const res = await markLessonDoneAction(lessonId);
              if (res.status === "error") {
                setError(res.message ?? "Gagal menandai selesai. Coba lagi.");
                return;
              }
              setDone(true);
              router.refresh();
            } catch {
              setError("Gagal menandai selesai. Coba lagi.");
            }
          })
        }
        className={`${PRESS} flex h-[52px] cursor-pointer items-center gap-2 rounded-[16px] bg-primary px-6 font-display text-[0.9375rem] font-extrabold uppercase tracking-[0.03em] text-white shadow-[0_5px_0_var(--color-primary-deep)] disabled:opacity-60`}
      >
        {pending ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <Check className="size-[18px]" strokeWidth={3} aria-hidden />}
        Tandai materi selesai
      </button>
      {error ? <p className="text-[0.875rem] font-bold text-brick-deep">{error}</p> : null}
    </div>
  );
}
