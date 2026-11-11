"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { TutorChat } from "@/app/(app)/tutor/tutor-chat";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { cn } from "@/lib/utils";

const STRUCTURE_TIPS = [
  "Kalimat butuh subjek + kata kerja. Pilihan tanpa kata kerja biasanya salah.",
  "Setelah frasa pembuka dan koma, cari subjek lalu kata kerja.",
  "Urutan terbalik (can individuals) hanya benar di pertanyaan atau setelah never/rarely.",
  "Buang pilihan dengan kata dobel: which that, and also, more better.",
  "Subjek tunggal pakai kata kerja tunggal (he goes), jamak pakai bentuk dasar.",
  "Setelah preposisi (in, of, by) pakai kata benda atau V-ing, bukan kata kerja biasa.",
  "Perhatikan kala: yesterday/ago pakai past, since/for pakai present perfect.",
  "Paralelisme: daftar dengan and/or harus bentuk sama (reading, writing, and speaking).",
];

/**
 * Asisten AI di samping soal. Layar lebar: panel di kolom kanan yang mendorong soal.
 * Layar kecil: panel menutupi layar. `children` menerima `trigger` (tombol "Tanya AI")
 * supaya pemanggil bisa menaruhnya di header.
 */
export function AskAi({
  context,
  section,
  children,
}: {
  context: string;
  section: string;
  children: (open: boolean, trigger: ReactNode) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Layar kecil: panel jadi overlay layar penuh (dialog sungguhan). Layar lg:
  // panel hanya kolom samping, halaman di belakang tetap bisa digulir.
  const [isDesktop, setIsDesktop] = useState(false);
  // Elemen yang difokuskan sebelum dialog layar kecil dibuka, untuk dikembalikan saat ditutup.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const mobileDialog = open && !isDesktop;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Layar kecil: dialog menutup layar. Simpan elemen yang sedang difokuskan saat
  // dibuka, lalu kembalikan fokus ke sana saat ditutup.
  useEffect(() => {
    if (!mobileDialog) return;
    const active = document.activeElement;
    restoreFocusRef.current = active instanceof HTMLElement ? active : null;
    return () => {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [mobileDialog]);

  // Layar kecil: panel overlay layar penuh, kunci scroll halaman di belakang
  // (teknik position:fixed agar iOS Safari tidak rubber-band).
  useBodyScrollLock(mobileDialog);

  const trigger = open ? null : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex h-10 cursor-pointer items-center gap-2 rounded-[12px] border-2 border-charcoal-line px-3 text-[0.875rem] font-bold text-charcoal-ink transition-colors hover:bg-charcoal-raised"
    >
      <Sparkles className="size-4 text-mango" aria-hidden />
      Tanya AI
    </button>
  );

  return (
    <div
      className={cn(
        open &&
          "lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6",
      )}
    >
      {/* Layar kecil saat dialog terbuka: konten di belakang dibuat inert supaya
          tidak bisa difokus/diklik dan Tab tetap berpindah di dalam dialog. */}
      <div className="min-w-0" inert={mobileDialog}>
        {children(open, trigger)}
      </div>

      {open ? (
        <aside
          role="dialog"
          aria-modal={isDesktop ? undefined : true}
          aria-label="Asisten AI"
          className="fixed inset-0 z-40 flex flex-col gap-3 bg-surface p-4 lg:sticky lg:inset-auto lg:top-[80px] lg:z-auto lg:mr-4 lg:mt-4 lg:h-[calc(100dvh-6rem)] lg:rounded-plate lg:border-2 lg:border-hairline"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Asisten AI
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup asisten"
              autoFocus
              className="flex size-10 items-center justify-center rounded-control hover:bg-surface-muted"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {section === "structure" ? (
            <details className="rounded-control border-2 border-hairline bg-surface-muted px-4 py-3 text-[0.9375rem]">
              <summary className="cursor-pointer font-bold">
                Trik cepat Structure
              </summary>
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-ink-subtle">
                {STRUCTURE_TIPS.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <TutorChat
            compact
            initialMessages={[]}
            context={context}
            suggestions={[
              "Kasih clue soal ini tanpa jawabannya.",
              "Pilihan mana yang bisa dibuang dulu?",
              "Jelaskan pola grammar soal ini.",
            ]}
            className="min-h-0 flex-1"
          />
        </aside>
      ) : null}
    </div>
  );
}
