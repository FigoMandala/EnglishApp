"use client";

import { Check, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { GaugeRing } from "@/components/charts";
import { LessonBody } from "@/components/lesson-body";
import { Lori } from "@/components/mascot";
import { SpeechBubble } from "@/components/ui/bubble";
import { cn } from "@/lib/utils";

import { markLessonDoneAction } from "../../belajar/actions";


export type LessonSection = { title: string; body: string };
export type TocItem = { slug: string; title: string; completed: boolean };

const PRESS = "transition-[transform,translate,box-shadow,filter] duration-150 active:translate-y-[5px] active:shadow-none disabled:cursor-default";

/**
 * Materi per langkah (satu bagian `##` = satu langkah) dengan rel langkah di kiri,
 * isi di tengah, penguasaan + daftar materi di kanan. Langkah terakhir selalu latihan.
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

  const items = toc.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()));
  const pct = mastery.total > 0 ? Math.round((mastery.correct / mastery.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Remah roti" className="flex items-center gap-2 text-[0.875rem] font-bold text-ink-subtle">
        <Link href="/materi" className="text-ink-muted hover:text-primary-deep hover:underline">
          Materi Grammar
        </Link>
        <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
        <span aria-current="page">{title}</span>
      </nav>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        {/* Rel langkah */}
        <nav
          aria-label="Langkah materi"
          className="flex gap-1 overflow-x-auto rounded-plate border-2 border-hairline bg-surface p-3 xl:w-[220px] xl:shrink-0 xl:flex-col xl:p-4"
        >
          <span className="eyebrow hidden px-2 pb-2 text-ink-subtle xl:block">
            {steps.length} langkah
          </span>
          {steps.map((label, i) => {
            const sel = i === step;
            const doneStep = i < step;
            return (
              <button
                key={label + i}
                type="button"
                aria-current={sel ? "step" : undefined}
                onClick={() => setStep(i)}
                className={cn(
                  "flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-[12px] px-2 text-left text-[0.875rem]",
                  sel ? "bg-primary-soft font-extrabold text-primary-deep" : "font-bold text-ink-muted hover:bg-surface-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full",
                    doneStep && "bg-primary text-white",
                    sel && "border-[3px] border-primary bg-white",
                    !sel && !doneStep && "border-2 border-hairline-strong",
                  )}
                >
                  {doneStep ? <Check className="size-3" strokeWidth={3.6} /> : null}
                </span>
                {label}
              </button>
            );
          })}
        </nav>

        {/* Isi */}
        <article className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-col gap-5 rounded-hero border-2 border-hairline bg-surface p-6 shadow-card sm:p-8">
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow text-primary-deep">
                {eyebrow} · LANGKAH {step + 1} DARI {steps.length}
              </span>
              <h1 className="font-display text-[1.875rem] font-black leading-[1.15] tracking-[-0.02em] sm:text-[2rem]">
                {onPractice ? "Coba sendiri" : sections[step].title}
              </h1>
              <p className="text-[0.9375rem] font-bold text-ink-subtle">{title}</p>
            </div>

            <div className="flex items-end gap-2">
              <Lori mood={onPractice ? "cheer" : "talk"} size={80} className="shrink-0" />
              <SpeechBubble who="Lori" className="pop mb-6 flex-1" key={step}>
                {bubble}
              </SpeechBubble>
            </div>

            {onPractice ? (
              <div key="practice" className="rise">
                {practice}
              </div>
            ) : (
              <div
                key={step}
                className="pop-in max-w-[720px] [&_li]:text-[1.0625rem] [&_p]:text-[1.0625rem] [&_p]:leading-relaxed"
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

        {/* Samping */}
        <aside aria-label="Daftar materi" className="flex w-full flex-col gap-4 xl:w-[280px] xl:shrink-0">
          <div className="flex flex-col items-center gap-2.5 rounded-plate border-2 border-hairline bg-surface p-5 text-center">
            <span className="eyebrow text-ink-subtle">Penguasaan topik</span>
            <GaugeRing
              value={pct}
              tone={pct >= 75 ? "primary" : pct >= 50 ? "mango" : "brick"}
              label={`Penguasaan ${pct} persen`}
              size={110}
            />
            <span className="text-[0.8125rem] text-ink-subtle">
              {mastery.total > 0
                ? `${mastery.correct} dari ${mastery.total} soal benar. Jawab semua benar untuk menandai selesai.`
                : "Belum ada soal yang dijawab."}
            </span>
          </div>

          <div className="flex flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-4">
            <h2 className="font-display text-[1.0625rem] font-extrabold">{tocTitle}</h2>
            <label className="relative block">
              <span className="sr-only">Cari materi</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari materi…"
                className="h-11 w-full rounded-[12px] border-2 border-hairline bg-surface-muted pl-10 pr-3 text-[0.9375rem] focus:border-primary focus:outline-none"
              />
            </label>
            <ul className="flex max-h-[360px] flex-col gap-0.5 overflow-y-auto">
              {items.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/materi/${t.slug}`}
                    aria-current={t.slug === currentSlug ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-[12px] px-2 text-[0.875rem]",
                      t.slug === currentSlug ? "bg-primary-soft font-extrabold text-primary-deep" : "font-semibold hover:bg-surface-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-3.5 shrink-0 rounded-full border-2",
                        t.completed
                          ? "border-primary bg-primary"
                          : t.slug === currentSlug
                            ? "border-primary bg-white"
                            : "border-hairline-strong bg-white",
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

          <Link
            href="/tutor"
            className="flex items-center gap-3 rounded-plate border-2 border-hairline bg-surface p-4 transition-colors hover:border-primary-line"
          >
            <Lori mood="talk" size={48} />
            <span className="flex-1">
              <strong className="block font-display text-[1rem]">Tanya Lori</strong>
              <span className="text-[0.8125rem] text-ink-subtle">Bingung? Tanyakan contoh lain di Tutor AI.</span>
            </span>
            <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
          </Link>
        </aside>
      </div>
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
