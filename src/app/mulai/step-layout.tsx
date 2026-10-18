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
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1280px] items-center gap-6 px-6 py-6 sm:px-14">
        <Link
          href={backHref}
          aria-label={closeInstead ? "Keluar dari pengaturan awal" : "Kembali ke langkah sebelumnya"}
          className="grid size-11 shrink-0 place-items-center rounded-[12px] text-ink-subtle hover:bg-surface-muted"
        >
          {closeInstead ? <X className="size-6" strokeWidth={2.6} aria-hidden /> : <ChevronLeft className="size-6" strokeWidth={2.6} aria-hidden />}
        </Link>
        <div
          role="progressbar"
          aria-label="Langkah pengaturan"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step}
          className="h-4 flex-1 overflow-hidden rounded-full bg-hairline"
        >
          <div
            className="grow-x h-full rounded-full bg-primary shadow-[inset_0_-4px_0_var(--color-primary-deep)]"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-[0.9375rem] font-bold text-ink-subtle">
          Langkah {step} dari {total}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-wrap items-center gap-14 px-6 pb-8 pt-2 sm:px-14">
        <section aria-live="polite" className="flex w-full max-w-[420px] flex-col items-start gap-3 lg:flex-1">
          <div key={bubble.title} className="pop relative rounded-[22px] border-2 border-hairline bg-surface px-[22px] py-5 shadow-[0_4px_0_var(--color-hairline)] [animation-delay:200ms]">
            <p className="font-display text-[1.375rem] font-extrabold leading-tight">{bubble.title}</p>
            <p className="mt-2 text-[1rem] leading-normal text-ink-subtle">{bubble.body}</p>
          </div>
          <div className={cn("ml-2", hop && "m-hop")}>
            <Lori mood={mood} size={240} label="Lori memperhatikan pilihanmu" />
          </div>
        </section>
        <section className="flex min-w-0 flex-1 basis-[560px] flex-col gap-6">{children}</section>
      </main>

      <footer className="border-t-2 border-hairline bg-surface-muted">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-14">
          {skipHref ? (
            <Link href={skipHref} className="flex min-h-11 items-center font-bold text-primary-deep hover:underline">
              {skipLabel}
            </Link>
          ) : (
            <span />
          )}
          {canNext ? (
            <Link
              href={nextHref}
              onClick={onNext}
              className="ledge pop flex min-h-14 min-w-[220px] items-center justify-center rounded-[16px] bg-primary px-7 font-display text-[1.1875rem] font-extrabold tracking-[0.02em] text-white"
            >
              {nextLabel}
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="min-h-14 min-w-[220px] cursor-not-allowed rounded-[16px] bg-hairline px-7 font-display text-[1.1875rem] font-extrabold tracking-[0.02em] text-[#6a6f73]"
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
  "rise flex w-full cursor-pointer items-center gap-4 rounded-[20px] border-2 px-5 py-[18px] text-left transition-[transform,box-shadow,background-color] active:translate-y-1 active:shadow-none";
