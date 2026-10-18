"use client";

import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Kerangka layar penuh mode latihan: header progres, isi, footer aksi (sesuai mockup). */
export function DrillPage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-canvas text-ink">{children}</div>;
}

export function DrillHeader({
  exitHref,
  value,
  max,
  barClass = "bg-primary shadow-[inset_0_-5px_0_var(--color-primary-deep)]",
  trailing,
}: {
  exitHref: string;
  value: number;
  max: number;
  barClass?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="mx-auto flex w-full max-w-[1180px] items-center gap-5 px-6 py-6 sm:px-14">
      <Link
        href={exitHref}
        aria-label="Keluar dari latihan"
        className="grid size-11 shrink-0 place-items-center rounded-[12px] text-ink-subtle hover:bg-surface-muted"
      >
        <X className="size-6" strokeWidth={2.6} aria-hidden />
      </Link>
      <div
        role="progressbar"
        aria-label="Kemajuan latihan"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-[18px] flex-1 overflow-hidden rounded-full bg-hairline"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", barClass)}
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        />
      </div>
      {trailing ?? (
        <span className="shrink-0 text-[0.9375rem] font-extrabold tabular-nums text-ink-subtle">
          {value} / {max}
        </span>
      )}
    </header>
  );
}

export function DrillMain({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("mx-auto w-full max-w-[1180px] flex-1 px-6 pb-8 pt-1 sm:px-14", className)}>{children}</main>
  );
}

export function DrillFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 border-t-2 border-hairline bg-surface-muted">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-14">
        {children}
      </div>
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
  return (
    <footer
      aria-live="assertive"
      className={cn(
        "rise sticky bottom-0 border-t-2",
        tone === "right" ? "border-[#9fd0b3] bg-primary-soft" : "border-[#efb4a2] bg-brick-soft",
      )}
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6 px-6 py-5 sm:px-14">
        <div className={tone === "right" ? "text-primary-deep" : "text-brick-deep"}>
          <p className="font-display text-[1.5rem] font-black">{title}</p>
          {body ? <p className="mt-1 text-[1rem]">{body}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">{children}</div>
      </div>
    </footer>
  );
}

const BTN =
  "flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[16px] px-7 font-display text-[1.1875rem] font-extrabold tracking-[0.02em] disabled:cursor-default";

/** Tombol aksi utama bergaya "ledge". */
export function PrimaryButton({
  className,
  ...props
}: React.ComponentProps<"button"> & { className?: string }) {
  return <button {...props} className={cn("ledge min-w-[220px] bg-primary text-white", BTN, className)} />;
}

export function SecondaryButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={cn(
        BTN,
        "border-2 border-hairline bg-surface text-ink shadow-[0_4px_0_var(--color-hairline)] transition-[transform,box-shadow] active:translate-y-1 active:shadow-none",
        className,
      )}
    />
  );
}

export function PrimaryLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return <Link {...props} className={cn("ledge min-w-[220px] bg-primary text-white", BTN, className)} />;
}
