"use client";

import { Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
    <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.9375rem] font-bold text-[#f2c878]">
      <Clock className="size-4" aria-hidden />
      {left > 0 ? (
        <>
          Sisa waktu section <span className="tnum font-display text-[1.125rem]">{clock(left)}</span>
          <span className="font-medium text-[#d3ccbe]">Timer tetap jalan walau kamu keluar dari browser.</span>
        </>
      ) : (
        "Waktu section ini sudah habis."
      )}
    </p>
  );
}

/** Overlay saat soal dibuat: tampil penuh layar, dengan timer berjalan dan jalan keluar kalau macet. */
export function PendingOverlay() {
  const [start] = useState(() => Date.now());
  const seconds = Math.floor((useNow() - start) / 1000);
  const stalled = seconds >= STALL_SECONDS;
  return createPortal(
    <div
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
    >
      <div
        role="status"
        className="flex max-w-md flex-col items-center gap-4 rounded-plate border-2 border-hairline bg-surface px-8 py-8 shadow-overlay"
      >
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-lg font-bold">Menyiapkan soal…</p>
          <p className="tnum text-[0.9375rem] text-ink-subtle">
            {seconds} detik. Latihan singkat biasanya di bawah 30 detik; simulasi penuh bisa 1–2 menit.
          </p>
        </div>
        {stalled ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-[0.9375rem] font-semibold text-warning-ink">
              Lebih lama dari biasanya. Mungkin koneksi atau server AI sedang lambat.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-control border-2 border-hairline bg-surface-muted px-4 text-[0.9375rem] font-bold hover:border-primary"
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
