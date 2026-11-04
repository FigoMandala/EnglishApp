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

export function DrillToolbar({ level }: { level: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function newSet() {
    const query = level === "all" ? `n=${Date.now()}` : `t=${level}&n=${Date.now()}`;
    startTransition(() => router.push(`/latihan/soal?${query}`));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex gap-1 rounded-control bg-canvas-deep p-1" aria-label="Tingkat kesulitan">
        {OPTIONS.map((option) => {
          const active = option.key === level;
          const href = option.key === "all" ? "/latihan/soal" : `/latihan/soal?t=${option.key}`;
          return (
            <Link
              key={option.key}
              href={href}
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
