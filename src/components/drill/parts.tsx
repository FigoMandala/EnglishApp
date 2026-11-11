"use client";

import { Check, X, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Kerangka layar penuh mode latihan: header progres, isi, footer aksi. */
export function DrillPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-canvas text-ink">{children}</div>;
}

export function DrillHeader({
  exitHref,
  exitLabel,
  value,
  max,
  barClass = "bg-primary shadow-[inset_0_-4px_0_rgba(0,0,0,0.12)]",
  trailing,
  xp,
  xpGain,
  xpNonce,
}: {
  exitHref: string;
  /** Label aksesibilitas tombol keluar; bawaan "Keluar dari latihan". */
  exitLabel?: string;
  value: number;
  max: number;
  barClass?: string;
  trailing?: ReactNode;
  /** XP sesi ini, ditampilkan mangga di kanan. */
  xp?: number;
  /** Gain XP terakhir (>0 → tampilkan float). */
  xpGain?: number;
  /** Nonce untuk memutar ulang float tiap gain. */
  xpNonce?: number;
}) {
  return (
    <header className="border-b-2 border-hairline">
      <div className="mx-auto flex w-full max-w-[1040px] items-center gap-[18px] px-6 py-4">
        <Link
          href={exitHref}
          aria-label={exitLabel ?? "Keluar dari latihan"}
          className="grid size-11 shrink-0 place-items-center rounded-[12px] text-ink-subtle hover:bg-surface"
        >
          <X className="size-6" strokeWidth={2.6} aria-hidden />
        </Link>
        <div
          role="progressbar"
          aria-label="Kemajuan latihan"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          className="h-3.5 flex-1 overflow-hidden rounded-full bg-canvas-deep"
        >
          <div
            className={cn("h-full w-full origin-left rounded-full transition-transform duration-300 ease-out", barClass)}
            style={{ transform: `scaleX(${max > 0 ? Math.min(1, value / max) : 0})` }}
          />
        </div>
        {trailing ?? (
          <span className="shrink-0 text-[0.875rem] font-extrabold tabular-nums text-ink-muted">
            {value} / {max}
          </span>
        )}
        {xp !== undefined ? (
          <span className="relative flex shrink-0 items-center gap-1 font-round text-[1.25rem] font-extrabold text-mango-deep">
            <Zap className="size-[18px] fill-mango text-mango" aria-hidden />
            {xp}
            {xpGain ? (
              <span
                key={xpNonce}
                aria-hidden
                className="xp-float absolute -top-2 right-0 font-round text-[0.9375rem] font-extrabold text-mango"
              >
                +{xpGain}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export function DrillMain({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-[760px] flex-1 px-6 pb-8 pt-10", className)}>{children}</main>;
}

export function DrillFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 border-t-2 border-hairline bg-canvas">
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-4 px-6 py-5">{children}</div>
    </footer>
  );
}

export function FeedbackBar({
  tone,
  title,
  body,
  children,
}: {
  tone: "right" | "wrong";
  title: string;
  body?: ReactNode;
  children: ReactNode;
}) {
  const right = tone === "right";
  return (
    <footer
      aria-live="assertive"
      className={cn("pop-in sticky bottom-0 border-t-2", right ? "border-primary-line bg-primary-soft" : "border-brick-line bg-brick-soft")}
    >
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-4 px-6 py-5">
        <span
          aria-hidden
          className={cn("grid size-[52px] shrink-0 place-items-center rounded-full text-white", right ? "bg-primary" : "bg-brick")}
        >
          {right ? <Check className="size-7" strokeWidth={3} /> : <X className="size-7" strokeWidth={3} />}
        </span>
        <div className={cn("min-w-0 flex-[1_1_260px]", right ? "text-primary-deep" : "text-brick-deep")}>
          <p className="font-display text-[1.5rem] font-black">{title}</p>
          {body ? <p className="text-[0.9375rem]">{body}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">{children}</div>
      </div>
    </footer>
  );
}

const BTN =
  "flex h-[54px] cursor-pointer items-center justify-center gap-2 rounded-[16px] px-8 font-display text-[1.0625rem] font-extrabold tracking-[0.03em] transition-[transform,translate,box-shadow,filter] duration-150 active:translate-y-[5px] active:shadow-none disabled:cursor-default disabled:bg-hairline disabled:text-ink-faint disabled:shadow-[0_5px_0_var(--color-hairline-strong)]";

/** Tombol aksi utama bergaya "ledge". */
export function PrimaryButton({ className, ...props }: React.ComponentProps<"button"> & { className?: string }) {
  return (
    <button {...props} className={cn(BTN, "min-w-[200px] bg-primary text-white shadow-[0_5px_0_var(--color-primary-deep)]", className)} />
  );
}

export function SecondaryButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={cn(BTN, "border-2 border-hairline bg-surface px-[22px] text-ink shadow-[0_4px_0_var(--color-hairline)]", className)}
    />
  );
}

export function PrimaryLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={cn(BTN, "min-w-[200px] bg-primary text-white shadow-[0_5px_0_var(--color-primary-deep)]", className)} />
  );
}
