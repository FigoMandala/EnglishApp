"use client";

import { ChevronDown, Sparkles, X } from "lucide-react";
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

const CARD = "rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(40,30,10,0.05),0_8px_28px_rgba(40,30,10,0.06)]";
const TRIGGER =
  "flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border-[1.5px] border-white/20 px-3.5 text-[0.8125rem] font-bold text-charcoal-ink transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mango aria-pressed:border-mango aria-pressed:bg-mango aria-pressed:text-mango-on";

/**
 * Asisten AI untuk soal. Dua penempatan:
 * - "dock": kolom kanan penuh tinggi yang mendorong konten (Listening, Structure). Layar kecil: dialog layar penuh.
 * - "inline": kartu di bawah soal (Reading), supaya teks bacaan dan soal tidak terjepit atau tertutup.
 * `children` menerima `trigger` (tombol "Tanya AI" untuk header) dan `inlinePanel` (hanya terisi pada "inline").
 */
export function AskAi({
  context,
  section,
  revealed,
  placement = "dock",
  children,
}: {
  context: string;
  section: string;
  /** Jawaban sudah diperiksa: tutor boleh membahas jawaban. */
  revealed: boolean;
  placement?: "dock" | "inline";
  children: (open: boolean, trigger: ReactNode, inlinePanel: ReactNode) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const inline = placement === "inline";
  // Layar kecil (dock): panel jadi overlay layar penuh (dialog sungguhan). Layar lg:
  // panel hanya kolom samping, halaman di belakang tetap bisa digulir.
  const [isDesktop, setIsDesktop] = useState(false);
  // Elemen yang difokuskan sebelum dialog layar kecil dibuka, untuk dikembalikan saat ditutup.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const mobileDialog = !inline && open && !isDesktop;

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

  const guard = revealed
    ? "Jawaban sudah diperiksa, jadi aku boleh membahas jawaban dan alasannya."
    : "Sebelum Periksa, aku hanya memberi clue. Pertanyaan di luar belajar Inggris dan TOEFL tidak kujawab.";

  const trigger = inline ? (
    <button type="button" aria-pressed={open} aria-expanded={open} onClick={() => setOpen((value) => !value)} className={TRIGGER}>
      <Sparkles className="size-4" aria-hidden />
      Tanya AI
    </button>
  ) : open ? null : (
    <button type="button" onClick={() => setOpen(true)} className={TRIGGER}>
      <Sparkles className="size-4 text-mango" aria-hidden />
      Tanya AI
    </button>
  );

  const chat = (
    <TutorChat
      compact
      // Inline dilipat: hanya chip saran + kolom satu baris; kirim pesan membuka kartu (obrolan yang sama).
      collapsed={inline && !open}
      onSend={inline ? () => setOpen(true) : undefined}
      initialMessages={[]}
      context={context}
      suggestions={[
        "Kasih clue soal ini tanpa jawabannya.",
        "Pilihan mana yang bisa dibuang dulu?",
        "Jelaskan pola grammar soal ini.",
      ]}
      className="min-h-0 flex-1"
    />
  );

  const tips =
    section === "structure" ? (
      <details className="rounded-[14px] bg-surface-muted px-4 py-3 text-[0.9375rem]">
        <summary className="cursor-pointer font-bold">Trik cepat Structure</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-ink-subtle">
          {STRUCTURE_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </details>
    ) : null;

  // Reading: kartu di bawah soal. Obrolan tetap terpasang saat dilipat (riwayat tidak hilang); yang tampil hanya chip dan kolom tulis.
  const inlinePanel = inline ? (
    <section aria-label="Asisten AI" className={cn(CARD, "overflow-hidden")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[72px] w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      >
        <span aria-hidden className="grid size-[38px] shrink-0 place-items-center rounded-[12px] bg-primary-soft text-primary-deep">
          <Sparkles className="size-5" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <strong className="block font-display text-[1.125rem] font-bold tracking-[-0.01em]">Asisten AI</strong>
          <span className="text-[0.8125rem] font-medium text-ink-subtle">
            {revealed ? "Boleh bahas jawaban dan alasannya." : "Clue saja sampai kamu menekan Periksa."}
          </span>
        </span>
        <ChevronDown
          className={cn("size-5 shrink-0 text-ink-subtle transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <div className={cn("flex flex-col gap-3 border-t border-hairline-soft px-5 pb-5 pt-4", open && "h-[440px]")}>
        {open ? (
          <p className="rounded-[12px] bg-mango-soft px-3.5 py-2.5 text-[0.8125rem] font-semibold leading-snug text-mango-ink">{guard}</p>
        ) : null}
        {chat}
      </div>
    </section>
  ) : null;

  return (
    // Dock layar lebar: panel menempel penuh di sisi kanan (fixed); konten, termasuk header dan
    // footer sticky milik pemanggil, disisakan ruang 24rem di kanan.
    <div className={cn(!inline && open && "lg:pr-[24rem]")}>
      {/* Layar kecil saat dialog terbuka: konten di belakang dibuat inert supaya
          tidak bisa difokus/diklik dan Tab tetap berpindah di dalam dialog. */}
      <div className="min-w-0" inert={mobileDialog}>
        {children(open, trigger, inlinePanel)}
      </div>

      {!inline && open ? (
        <aside
          role="dialog"
          aria-modal={isDesktop ? undefined : true}
          aria-label="Asisten AI"
          className="fixed inset-0 z-40 flex flex-col gap-3 bg-surface p-4 shadow-[0_0_0_1px_rgba(40,30,10,0.06),-12px_0_40px_rgba(40,30,10,0.1)] lg:left-auto lg:w-[24rem] lg:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2.5 font-display text-[1.25rem] font-bold tracking-[-0.02em]">
              <span aria-hidden className="grid size-[34px] place-items-center rounded-[11px] bg-primary-soft text-primary-deep">
                <Sparkles className="size-[18px]" />
              </span>
              Asisten AI
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup asisten"
              autoFocus
              className="flex size-11 cursor-pointer items-center justify-center rounded-[12px] text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <p className="rounded-[12px] bg-mango-soft px-3.5 py-2.5 text-[0.8125rem] font-semibold leading-snug text-mango-ink">{guard}</p>

          {tips}

          {chat}
        </aside>
      ) : null}
    </div>
  );
}
