"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { TutorChat } from "@/app/(app)/tutor/tutor-chat";
import { Lori } from "@/components/mascot";

const SUGGESTIONS = [
  "Jelaskan bagian ini dengan bahasa yang lebih sederhana.",
  "Beri 3 contoh kalimat lain.",
  "Apa kesalahan yang paling sering terjadi di sini?",
];

/**
 * Tombol melayang "Tanya Lori" yang mengembang jadi panel obrolan di tempat (seperti chatbot situs),
 * memakai TutorChat yang sama. `context` = materi dan langkah yang sedang dibaca.
 * Obrolan tetap terpasang setelah ditutup supaya percakapan tidak hilang.
 */
export function LoriWidget({ context }: { context: string }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed bottom-24 right-4 z-30 flex flex-col items-end gap-3 lg:bottom-8 lg:right-8">
      {everOpened ? (
        <section
          role="dialog"
          aria-label="Tanya Lori"
          hidden={!open}
          className="pop flex h-[min(640px,calc(100dvh-130px))] w-[min(380px,calc(100vw-2rem))] flex-col gap-3 overflow-hidden rounded-[24px] border-2 border-hairline bg-surface p-4 shadow-[0_10px_0_var(--color-hairline),0_20px_50px_rgba(40,30,10,0.18)]"
        >
          <header className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-end justify-center overflow-hidden rounded-full bg-primary-soft">
              <Lori mood="wave" size={50} className="-mb-2" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <strong className="block font-display text-[1.0625rem]">Tanya Lori</strong>
              <span className="text-[0.75rem] text-ink-subtle">Tanya soal materi yang sedang kamu baca</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup obrolan"
              className="flex size-10 cursor-pointer items-center justify-center rounded-[12px] text-ink-subtle hover:bg-surface-muted hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <TutorChat compact initialMessages={[]} context={context} suggestions={SUGGESTIONS} className="min-h-0 flex-1" />
        </section>
      ) : null}

      {open ? null : (
        <button
          type="button"
          aria-label="Tanya Lori"
          aria-expanded={false}
          onClick={() => {
            setEverOpened(true);
            setOpen(true);
          }}
          className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-primary-line bg-surface py-1.5 pl-1.5 pr-4 shadow-[0_5px_0_var(--color-primary-line)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
        >
          <Lori mood="talk" size={44} />
          <span className="font-display text-[0.9375rem] font-extrabold">Tanya Lori</span>
        </button>
      )}
    </div>
  );
}
