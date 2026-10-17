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
    startTransition(() => router.push(`/latihan?${query}`));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tingkat kesulitan">
        {OPTIONS.map((option) => {
          const active = option.key === level;
          const href = option.key === "all" ? "/latihan" : `/latihan?t=${option.key}`;
          return (
            <Link
              key={option.key}
              href={href}
              role="tab"
              aria-selected={active}
              className={cn(
                "flex h-10 items-center rounded-control border-2 px-4 text-[0.875rem] font-bold transition-colors",
                active
                  ? "border-primary bg-primary-soft text-primary-deep"
                  : "border-hairline bg-surface text-ink-subtle hover:border-primary hover:text-primary",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        onClick={newSet}
        disabled={pending}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-control border-2 border-hairline bg-surface px-4 text-[0.875rem] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
      >
        <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden />
        Ganti soal
      </button>
    </div>
  );
}
