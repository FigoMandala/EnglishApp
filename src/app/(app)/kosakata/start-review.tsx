"use client";

import { ArrowRight, Loader2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

const COUNTS = [10, 20, 40] as const;

export function StartReviewButton({ dueCount, newWaiting = 0 }: { dueCount: number; newWaiting?: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);
  // Batas sesi default dari tombol utama (perhitungan sama saat mulai):
  // minimal 10 kartu, maksimal 60.
  const defaultLimit = Math.min(60, Math.max(10, dueCount));

  function start(count: number) {
    setLoading(count);
    // Navigasi kadang batal (popstate, route tergantung); kembalikan tombol
    // setelah jeda supaya tidak spin selamanya kalau pindah halaman gagal.
    window.setTimeout(() => setLoading((cur) => (cur === count ? null : cur)), 4000);
    router.push(`/kosakata/review?n=${count}`);
  }

  return (
    <div className="relative flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => (dueCount > 0 ? start(Math.min(60, Math.max(10, dueCount))) : setOpen((prev) => !prev))}
        aria-expanded={dueCount > 0 ? undefined : open}
        disabled={loading !== null}
        className={buttonVariants({
          variant: "reward",
          size: "lg",
          className: "gap-2.5 px-7 text-[1.125rem] disabled:opacity-70",
        })}
      >
        {loading !== null && dueCount > 0 ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        {dueCount > 0 ? "MULAI ULANG" : "PELAJARI KATA BARU"}
        <ArrowRight className="size-5" strokeWidth={2.8} aria-hidden />
      </button>
      {dueCount > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="cursor-pointer text-[0.8125rem] font-extrabold text-mango-ink underline-offset-2 hover:underline"
        >
          Atur jumlah kartu
        </button>
      ) : null}
      {open ? (
        <div className="pop-in flex flex-wrap items-center gap-2 rounded-control border-2 border-mango-line bg-surface p-2 shadow-overlay">
          <span className="px-2 text-[0.8125rem] font-bold text-ink-subtle">{dueCount > 0 && newWaiting > 0 ? "Ulang + baru:" : dueCount > 0 ? "Ulang:" : "Kata baru:"}</span>
          {COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => start(count)}
              disabled={loading !== null}
              className="flex h-11 min-w-12 cursor-pointer items-center justify-center rounded-[10px] border-2 border-hairline bg-surface-muted px-3 text-[0.875rem] font-extrabold text-ink hover:border-mango disabled:opacity-60"
            >
              {loading === count ? <Loader2 className="size-4 animate-spin" aria-hidden /> : count}
              <span className="ml-1 text-[0.75rem] font-bold text-ink-subtle">kartu</span>
            </button>
          ))}
        </div>
      ) : null}
      {dueCount > 0 && newWaiting > 0 ? (
        <p className="text-[0.75rem] font-bold text-ink-subtle">
          {Math.min(dueCount, defaultLimit)} ulang didahulukan, sisanya kata baru.
        </p>
      ) : null}
    </div>
  );
}
