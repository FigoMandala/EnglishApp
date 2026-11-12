"use client";

import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition, useState } from "react";

import { PendingOverlay } from "@/components/pending-overlay";
import { Button } from "@/components/ui/button";
import { partBatches, SIM_PARTS } from "@/lib/eprt-simulation";

import { startSimulationAction } from "./actions";

export function StartSimulationButton({
  disabled,
  className,
  label = "Mulai simulasi baru",
  section,
}: {
  disabled?: boolean;
  className?: string;
  label?: string;
  /** Mini-test satu section; kosong untuk simulasi penuh. */
  section?: "listening" | "structure" | "reading";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-stretch gap-2">
      {pending ? <PendingOverlay /> : null}
      <Button
        className={className}
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            const result = await startSimulationAction(section);
            if (result?.status === "error") setError(result.message ?? "Gagal memulai simulasi.");
          })
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-[0.8125rem] font-medium text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Membuka satu bagian: siapkan semua batch bagian itu lewat permintaan kecil
 * berurutan (masing-masing di bawah batas durasi Vercel), lalu masuk ke soal.
 * Tampilan bagian tidak berubah.
 */
export function OpenPartButton({
  id,
  index,
  label,
  className,
}: {
  id: number;
  index: number;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const part = SIM_PARTS[index];
  const batches = part ? partBatches(part) : [];
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const pending = running;

  async function run() {
    if (!part || running) return;
    setError(null);
    setRunning(true);
    setDone(0);
    try {
      for (const batch of batches) {
        const response = await fetch("/api/eprt-simulation/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, index, batch: batch.index }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { message?: string };
          setError(data.message ?? "Gagal menyiapkan soal.");
          setRunning(false);
          return;
        }
        setDone(batch.index + 1);
      }
    } catch {
      setError("Koneksi terputus saat menyiapkan soal.");
      setRunning(false);
      return;
    }
    router.push(`/eptr/simulasi?id=${id}&p=${index}`);
    router.refresh();
    // Kalau navigasi ternyata batal, tombol tidak boleh spin selamanya.
    window.setTimeout(() => setRunning(false), 4000);
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button type="button" disabled={pending} className={className} onClick={run}>
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        {label}
      </Button>
      {pending ? <PendingOverlay detail={`${done} dari ${batches.length} paket soal siap`} /> : null}
      {error ? (
        <p role="alert" className="text-[0.875rem] font-semibold text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const prefetched = new Set<string>();

/** Menyiapkan bagian berikutnya selagi bagian sekarang dikerjakan. */
export function PrefetchPart({ id, index }: { id: number; index: number }) {
  useEffect(() => {
    const key = `${id}:${index}`;
    if (prefetched.has(key)) return;
    prefetched.add(key);
    const part = SIM_PARTS[index];
    if (!part) return;
    (async () => {
      try {
        for (const batch of partBatches(part)) {
          const response = await fetch("/api/eprt-simulation/prepare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, index, batch: batch.index }),
          });
          if (!response.ok) {
            prefetched.delete(key);
            return;
          }
        }
      } catch {
        prefetched.delete(key);
      }
    })();
  }, [id, index]);
  return null;
}
