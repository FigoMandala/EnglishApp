"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { key: "all", label: "Campur" },
  { key: "basic", label: "Dasar" },
  { key: "intermediate", label: "Menengah" },
  { key: "advanced", label: "Lanjut" },
] as const;

function href(level: string, choiceOnly: boolean, fresh = false) {
  const q = new URLSearchParams();
  if (level !== "all") q.set("t", level);
  if (choiceOnly) q.set("j", "pilgan");
  if (fresh) q.set("n", String(Date.now()));
  return `/latihan/soal${q.size ? `?${q}` : ""}`;
}

export function DrillToolbar({ level, choiceOnly }: { level: string; choiceOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newSet() {
    startTransition(() => router.push(href(level, choiceOnly, true)));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex gap-1 rounded-control bg-canvas-deep p-1" aria-label="Tingkat kesulitan">
        {OPTIONS.map((option) => {
          const active = option.key === level;
          return (
            <Link
              key={option.key}
              href={href(option.key, choiceOnly)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex h-10 items-center rounded-[10px] px-4 text-[0.875rem] transition-colors",
                active ? "bg-surface font-extrabold shadow-[0_2px_0_var(--color-hairline-strong)]" : "font-bold text-ink-muted hover:text-ink",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        aria-pressed={choiceOnly}
        onClick={() => startTransition(() => router.push(href(level, !choiceOnly)))}
        className={cn(
          "flex h-10 cursor-pointer items-center rounded-control border-2 px-4 text-[0.875rem] font-extrabold transition-colors",
          choiceOnly ? "border-primary bg-primary-soft text-primary-deep" : "border-hairline text-ink-muted hover:text-ink",
        )}
      >
        Pilgan saja
      </button>
      <button
        type="button"
        onClick={newSet}
        disabled={pending}
        className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border-2 border-hairline bg-surface px-4 text-[0.875rem] font-extrabold text-ink shadow-[0_3px_0_var(--color-hairline)] transition-transform active:translate-y-[3px] active:shadow-none disabled:opacity-60"
      >
        <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
        Ganti soal
      </button>
    </div>
  );
}
