"use client";

import { useEffect } from "react";

import { logClientErrorAction } from "@/app/error-actions";
import { Lori } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Layar error bersama untuk semua error boundary (root, grup app, admin).
 * Next.js butuh file error.tsx per segmen; isi satu layar ini dipakai ulang.
 */
export function ErrorScreen({
  error,
  title,
  description,
  logTag,
  onReset,
  mascot = true,
  className,
}: {
  error: Error & { digest?: string };
  title: string;
  description: string;
  /** Prefix log console, mis. "[app]" atau "[admin]". */
  logTag: string;
  onReset: () => void;
  mascot?: boolean;
  /** Kelas tambahan wadah, mis. latar penuh untuk boundary root. */
  className?: string;
}) {
  useEffect(() => {
    console.error(`${logTag} halaman gagal dirender:`, error.digest ?? error.message);
    // Laporkan ke audit_logs supaya muncul di dashboard admin (monitoring).
    void logClientErrorAction({ message: error.message, digest: error.digest });
  }, [error, logTag]);

  return (
    <div className={cn("flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center", className)}>
      {mascot ? <Lori mood="sad" size={120} label="Lori kelihatan bingung" /> : null}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[1.5rem] font-black">{title}</h1>
        <p className="text-[0.9375rem] text-ink-subtle">
          {description}{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">
            {error.digest ?? "-"}
          </code>
        </p>
      </div>
      <button onClick={onReset} className={buttonVariants({ className: "min-w-[200px]" })}>
        Coba lagi
      </button>
    </div>
  );
}
