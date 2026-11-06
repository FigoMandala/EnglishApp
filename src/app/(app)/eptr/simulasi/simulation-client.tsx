"use client";

import { Loader2, Play, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition, useState } from "react";

import { Button } from "@/components/ui/button";
import { partBatches, SIM_PARTS } from "@/lib/eprt-simulation";

import { createFastSimulationAction, startSimulationAction } from "./actions";

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

/** Jumlah bagian yang disiapkan bersamaan di mode cepat. */
const PARALLEL_PARTS = 3;

/**
 * Mode cepat: siapkan seluruh 140 soal lewat permintaan kecil, satu batch per
 * permintaan, beberapa bagian sekaligus. Tiap permintaan selesai di bawah batas durasi Vercel,
 * jadi tetap jalan walau server action tidak boleh lama. Tampilan bagian tidak
 * berubah, hasil tiap batch digabung jadi satu bagian utuh.
 */
export function StartFastButton({
  disabled,
  className,
  label = "Siapkan semua soal (140)",
}: {
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number; part: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = progress !== null;

  async function prepare(payload: { id: number; index: number; batch?: number }) {
    const response = await fetch("/api/eprt-simulation/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) return null;
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    return data.message ?? "Gagal menyiapkan sebagian soal.";
  }

  async function run() {
    setError(null);
    const total = SIM_PARTS.reduce((sum, part) => sum + partBatches(part).length, 0);
    setProgress({ done: 0, total, part: 1 });

    const created = await createFastSimulationAction();
    if (created.status === "error" || !created.id) {
      setProgress(null);
      setError(created.message ?? "Gagal memulai simulasi.");
      return;
    }
    const id = created.id;

    // Bagian berbeda disiapkan paralel (masing-masing sesi sendiri); batch di
    // dalam satu bagian tetap berurutan karena digabung ke sesi yang sama.
    let done = 0;
    let next = 0;
    let failure: string | null = null;
    async function worker() {
      while (!failure && next < SIM_PARTS.length) {
        const index = next;
        next += 1;
        for (const batch of partBatches(SIM_PARTS[index])) {
          if (failure) return;
          const result = await prepare({ id, index, batch: batch.index });
          if (result) {
            failure = result;
            return;
          }
          done += 1;
          setProgress({ done, total, part: index + 1 });
        }
      }
    }
    try {
      await Promise.all(Array.from({ length: PARALLEL_PARTS }, worker));
    } catch {
      failure = "Koneksi terputus saat menyiapkan soal.";
    }
    if (failure) {
      setProgress(null);
      setError(failure);
      return;
    }

    router.push(`/eptr/simulasi?id=${id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secondary"
        className={`${className ?? ""} ${pending ? "disabled:opacity-100" : ""}`}
        disabled={disabled || pending}
        onClick={run}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Zap className="size-3.5" aria-hidden />}
        {pending ? "Menyiapkan soal..." : label}
      </Button>
      {progress ? (
        <div role="status" className="flex w-full flex-col gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-current/15">
            <div
              className="h-full w-full origin-left rounded-full bg-mint transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${progress.total ? progress.done / progress.total : 0})` }}
            />
          </div>
          <p className="tnum text-[0.8125rem] opacity-80">
            {progress.done} dari {progress.total} paket soal siap (bagian {progress.part} dari {SIM_PARTS.length}).
            Jangan tutup halaman ini.
          </p>
        </div>
      ) : null}
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
      {pending ? (
        <p role="status" className="text-[0.875rem] opacity-80">
          Menyiapkan soal... ({done}/{batches.length})
        </p>
      ) : null}
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
