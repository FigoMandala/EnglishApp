"use client";

import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

const COUNTS = [10, 20, 40] as const;

export function StartReviewButton({ dueCount }: { dueCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);

  function start(count: number) {
    setLoading(count);
    router.push(`/kosakata/review?n=${count}`);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex h-12 items-center gap-2 rounded-control px-6 text-[0.9375rem] font-bold shadow-card transition-transform hover:-translate-y-0.5",
          dueCount > 0 ? "bg-primary text-white" : "border-2 border-hairline bg-surface text-ink-subtle hover:border-primary",
        )}
      >
        <Play className="size-4" aria-hidden />
        {dueCount > 0 ? `Ulangi ${dueCount} kartu jatuh tempo` : "Belum ada kartu jatuh tempo"}
      </button>
      {open ? (
        <div className="pop-in flex items-center gap-2 rounded-control border-2 border-hairline bg-surface p-2 shadow-card">
          <span className="px-2 text-[0.8125rem] font-semibold text-ink-subtle">
            {dueCount > 0 ? "Pelajari:" : "Belum jatuh tempo — pelajari kata baru:"}
          </span>
          {COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => start(count)}
              disabled={loading !== null}
              className="flex h-10 min-w-12 items-center justify-center rounded-[10px] border-2 border-hairline bg-surface-muted px-3 text-[0.875rem] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {loading === count ? <Loader2 className="size-4 animate-spin" aria-hidden /> : count}
              <span className="ml-1 text-[0.6875rem] font-semibold text-ink-faint">kartu</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
