"use client";

import { Clock, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Lori } from "@/components/mascot";

/** Detik sebelum overlay menawarkan muat ulang; server action tidak bisa dibatalkan dari klien. */
const STALL_SECONDS = 90;

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  return `${String(m).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Hitung mundur sisa waktu section; deadline dihitung sekali dari sisa waktu server saat halaman dimuat. */
export function SectionCountdown({ msLeft }: { msLeft: number }) {
  const [deadline] = useState(() => Date.now() + msLeft);
  const left = deadline - useNow();
  return (
    <p
      role="timer"
      aria-label={left > 0 ? `Sisa waktu section ${clock(left)}` : "Waktu section sudah habis"}
      className="inline-flex items-center gap-1.5 rounded-full bg-charcoal px-3 py-1.5 font-round text-[1.125rem] font-extrabold text-mango-line"
    >
      <Clock className="size-4" strokeWidth={2.6} aria-hidden />
      {left > 0 ? <span className="tnum">{clock(left)} tersisa</span> : <span className="font-sans text-[0.875rem]">Waktu section habis</span>}
    </p>
  );
}

/** Overlay saat soal dibuat: tampil penuh layar, dengan timer berjalan dan jalan keluar kalau macet. */
export function PendingOverlay() {
  const [start] = useState(() => Date.now());
  const seconds = Math.floor((useNow() - start) / 1000);
  const stalled = seconds >= STALL_SECONDS;
  // Fokus dipindah ke kartu status supaya Tab tidak menjelajah konten di
  // balik overlay layar penuh ini.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.focus();
  }, []);
  return createPortal(
    <div
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
    >
      <div
        ref={cardRef}
        role="status"
        tabIndex={-1}
        className="flex max-w-md flex-col items-center gap-4 rounded-[24px] bg-surface px-8 py-8 shadow-overlay focus:outline-none"
      >
        <Lori mood="think" size={112} />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="flex items-center gap-2 font-display text-[1.375rem] font-extrabold">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            Menyiapkan soal…
          </p>
          <p className="tnum text-[0.9375rem] text-ink-subtle">
            {seconds} detik. Latihan singkat biasanya di bawah 30 detik; simulasi penuh bisa 1–2 menit.
          </p>
        </div>
        {stalled ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-[0.9375rem] font-semibold text-mango-ink">
              Lebih lama dari biasanya. Mungkin koneksi atau server AI sedang lambat.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 cursor-pointer rounded-[12px] border-2 border-hairline bg-surface px-4 text-[0.9375rem] font-extrabold shadow-[0_3px_0_var(--color-hairline)]"
            >
              Muat ulang &amp; coba lagi
            </button>
          </div>
        ) : (
          <p className="text-[0.8125rem] text-ink-subtle">Jangan tutup halaman ini.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
