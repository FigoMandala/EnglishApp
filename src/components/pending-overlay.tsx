"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Lori } from "@/components/mascot";

/** Detik sebelum overlay menawarkan muat ulang; server action tidak bisa dibatalkan dari klien. */
const STALL_SECONDS = 90;

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const EPRT_HINT = "Latihan singkat biasanya di bawah 30 detik; simulasi penuh bisa 1–2 menit.";

/**
 * Overlay saat soal disiapkan: tampil penuh layar, dengan timer berjalan dan jalan keluar kalau macet.
 * `detail` untuk kemajuan (mis. "3 dari 9 paket siap"); `hint` mengganti perkiraan lama waktunya.
 */
export function PendingOverlay({ hint = EPRT_HINT, detail }: { hint?: string; detail?: string }) {
  const [start] = useState(() => Date.now());
  const seconds = Math.floor((useNow() - start) / 1000);
  const stalled = seconds >= STALL_SECONDS;
  // loading.tsx bisa dirender di server, tempat document belum ada: portal baru dibuat di browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Fokus dipindah ke kartu status supaya Tab tidak menjelajah konten di
  // balik overlay layar penuh ini.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.focus();
  }, [mounted]);
  if (!mounted) return null;
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
            {seconds} detik. {hint}
          </p>
          {detail ? <p className="tnum text-[0.875rem] font-bold text-ink-muted">{detail}</p> : null}
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
