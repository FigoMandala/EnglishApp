"use client";

import { Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { TutorChat } from "@/app/(app)/tutor/tutor-chat";
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
 * Layar kecil: panel menutupi layar. Tombol "Tanya AI" di atas soal membukanya.
 */
export function AskAi({
  context,
  section,
  children,
}: {
  context: string;
  section: string;
  children: (open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        open &&
          "lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6",
      )}
    >
      <div className="min-w-0">
        {!open ? (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-10 items-center gap-2 rounded-full border-2 border-primary/30 bg-primary-soft px-4 text-[0.9375rem] font-bold text-primary-deep transition-colors hover:border-primary"
            >
              <Sparkles className="size-4" aria-hidden />
              Tanya AI
            </button>
          </div>
        ) : null}
        {children(open)}
      </div>

      {open ? (
        <aside
          aria-label="Asisten AI"
          className="fixed inset-0 z-40 flex flex-col gap-3 bg-surface p-4 lg:sticky lg:inset-auto lg:top-4 lg:z-auto lg:h-[calc(100dvh-2rem)] lg:rounded-plate lg:border-2 lg:border-hairline"
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
              className="flex size-10 items-center justify-center rounded-control hover:bg-surface-muted"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {section === "structure" ? (
            <details className="rounded-control border-2 border-hairline px-4 py-3 text-[0.9375rem]">
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
