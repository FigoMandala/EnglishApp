"use client";

import { ChevronLeft, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Lori, type LoriMood } from "@/components/mascot";
import { cn } from "@/lib/utils";

/** Kerangka satu langkah onboarding: progres di atas, Lori + bubble di kiri, pilihan di kanan, tombol di bawah. */
export function OnboardingStep({
  step,
  total = 5,
  backHref,
  closeInstead,
  bubble,
  mood,
  hop,
  children,
  nextHref,
  canNext,
  nextLabel = "LANJUT",
  onNext,
  skipHref,
  skipLabel,
}: {
  step: number;
  total?: number;
  backHref: string;
  closeInstead?: boolean;
  bubble: { title: string; body: string };
  mood: LoriMood;
  hop?: boolean;
  children: ReactNode;
  nextHref: string;
  canNext: boolean;
  nextLabel?: string;
  onNext?: () => void;
  skipHref?: string;
  skipLabel?: string;
}) {
  return (
    <div className="page-enter flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-3 py-3 sm:gap-6 sm:px-14 sm:py-6">
        <Link
          href={backHref}
          aria-label={closeInstead ? "Keluar dari pengaturan awal" : "Kembali ke langkah sebelumnya"}
          className="grid size-11 shrink-0 place-items-center rounded-[12px] text-ink-subtle hover:bg-surface-muted"
        >
          {closeInstead ? <X className="size-6" strokeWidth={2.6} aria-hidden /> : <ChevronLeft className="size-6" strokeWidth={2.6} aria-hidden />}
        </Link>
        <div
          role="progressbar"
          aria-label={`Langkah ${step} dari ${total}`}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step}
          className="grid flex-1 gap-1.5"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn("h-2 rounded-full", i < step ? "bg-primary" : "bg-hairline")} />
          ))}
        </div>
        <span className="w-11 shrink-0 text-center text-[0.8125rem] font-extrabold text-ink-subtle">
          {step}/{total}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-4 px-4 pb-6 pt-1 sm:px-14 lg:flex-row lg:flex-wrap lg:items-center lg:gap-14 lg:pt-2">
        <section aria-live="polite" className="flex items-end gap-1 lg:max-w-[420px] lg:flex-1 lg:flex-col-reverse lg:items-start lg:gap-3">
          <div className={cn("shrink-0 lg:ml-2", hop && "m-hop")}>
            <Lori mood={mood} size={88} label="Lori memperhatikan pilihanmu" className="lg:hidden" />
            <Lori mood={mood} size={240} className="hidden lg:block" />
          </div>
          <div
            key={bubble.title}
            className="pop mb-6 rounded-[16px_16px_16px_4px] border-2 border-hairline bg-surface px-3 py-2.5 shadow-[0_3px_0_var(--color-hairline)] lg:mb-0 lg:rounded-[22px_22px_22px_6px] lg:px-[22px] lg:py-5"
            style={{ "--delay": "200ms" } as React.CSSProperties}
          >
            <p className="font-display text-[0.9375rem] font-extrabold leading-tight lg:text-[1.375rem]">{bubble.title}</p>
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-subtle lg:mt-2 lg:text-base">{bubble.body}</p>
          </div>
        </section>
        <section className="flex min-w-0 flex-1 flex-col gap-4 lg:basis-[560px] lg:gap-6">{children}</section>
      </main>

      <footer className="sticky bottom-0 border-t-2 border-hairline bg-canvas">
        <div className="mx-auto flex max-w-[1280px] flex-col-reverse gap-2 px-4 pb-5 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-14 sm:py-5">
          {skipHref ? (
            <Link
              href={skipHref}
              className="flex min-h-9 items-center justify-center text-[0.875rem] font-extrabold text-ink-muted hover:underline sm:min-h-11 sm:text-base"
            >
              {skipLabel}
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {canNext ? (
            <Link
              href={nextHref}
              onClick={onNext}
              className="flex h-[54px] items-center justify-center rounded-[16px] bg-primary px-7 font-display text-[1.0625rem] font-extrabold tracking-[0.03em] text-white shadow-[0_5px_0_var(--color-primary-deep)] transition-transform active:translate-y-[5px] active:shadow-none sm:min-w-[220px]"
            >
              {nextLabel}
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="h-[54px] cursor-not-allowed rounded-[16px] bg-hairline px-7 font-display text-[1.0625rem] font-extrabold tracking-[0.03em] text-ink-faint shadow-[0_5px_0_var(--color-hairline-strong)] sm:min-w-[220px]"
            >
              {nextLabel}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export const CHOICE =
  "rise flex w-full cursor-pointer items-center gap-3 rounded-[16px] border-2 px-3.5 py-2 text-left transition-[transform,box-shadow,background-color] active:translate-y-1 active:shadow-none sm:gap-4 sm:rounded-[20px] sm:px-5 sm:py-[18px]";
