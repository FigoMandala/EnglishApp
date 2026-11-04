"use client";

import { HelpCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Cefr } from "@/lib/cefr";
import { loadOnboarding, saveOnboarding } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { CHOICE, OnboardingStep } from "../step-layout";

const LEVELS: { cefr: Cefr; label: string; sub: string; t: string; b: string }[] = [
  { cefr: "A1", label: "Baru mulai", sub: "Tahu beberapa kata, belum bisa bikin kalimat", t: "Mulai dari nol itu keren.", b: "Kita pakai banyak gambar dan audio dulu. Grammar nyusul pelan-pelan." },
  { cefr: "A2", label: "Bisa sedikit", sub: "Paham kalimat pendek dan percakapan sederhana", t: "Fondasinya udah ada.", b: "Kita rapikan tenses dasar biar kalimatmu nggak cuma present terus." },
  { cefr: "B1", label: "Lumayan", sub: "Bisa ngobrol topik sehari-hari, masih sering ragu", t: "Zona favoritku!", b: "Di sini biasanya skor EPrT mulai naik cepat. Kita fokus ke pola soal." },
  { cefr: "B2", label: "Cukup lancar", sub: "Nonton film tanpa subtitle Indonesia, kadang miss", t: "Wah, tinggal dipoles.", b: "Kita kejar akurasi: artikel, preposisi, dan struktur kalimat kompleks." },
  { cefr: "C1", label: "Mahir", sub: "Nyaman baca jurnal dan diskusi panjang", t: "Oke, aku nggak akan bosenin.", b: "Kamu bisa lompati unit awal lewat tes cepat di tiap bagian." },
];

export default function LevelPage() {
  const [picked, setPicked] = useState<Cefr | null>(null);
  useEffect(() => setPicked(loadOnboarding().cefr), []);
  const cur = LEVELS.find((l) => l.cefr === picked);

  return (
    <OnboardingStep
      step={2}
      backHref="/mulai/tujuan"
      mood="think"
      bubble={{
        title: cur ? cur.t : "Hmm, kira-kira di mana ya?",
        body: cur ? cur.b : "Pilih yang paling mirip sama kamu. Salah pilih juga aman, jalurnya menyesuaikan sendiri.",
      }}
      canNext={Boolean(picked)}
      nextHref="/mulai/target"
    >
      <div className="rise">
        <h1 className="font-display text-[1.625rem] font-black leading-[1.15] tracking-[-0.02em] sm:text-[2.75rem] sm:leading-[1.05]">Bahasa Inggrismu sekarang segini?</h1>
        <p className="mt-1 text-[0.875rem] text-ink-subtle sm:mt-2.5 sm:text-[1.125rem]">Jujur aja, nggak ada yang nilai. Ini cuma titik mulai jalurmu.</p>
      </div>
      <div role="radiogroup" aria-label="Level bahasa Inggris saat ini" className="flex flex-col gap-3">
        {LEVELS.map((l, i) => {
          const sel = l.cefr === picked;
          const n = i + 1;
          return (
            <button
              key={l.cefr}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => {
                setPicked(l.cefr);
                saveOnboarding({ cefr: l.cefr });
              }}
              className={cn(
                CHOICE,
                "min-h-[72px] py-3.5",
                sel ? "border-primary bg-primary-soft shadow-[0_4px_0_var(--color-primary)]" : "border-hairline bg-surface shadow-[0_4px_0_var(--color-hairline)]",
              )}
              style={{ "--i": i } as React.CSSProperties}
            >
              <span aria-hidden className="flex h-8 shrink-0 items-end gap-1">
                {[1, 2, 3, 4, 5].map((bar) => (
                  <span
                    key={bar}
                    className={cn("grow-y w-2 rounded-[3px]", bar <= n ? (sel ? "bg-primary" : "bg-mango") : "bg-hairline")}
                    style={{ height: `${8 + bar * 5}px`, "--i": bar } as React.CSSProperties}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[1.1875rem] font-extrabold">{l.label}</span>
                <span className="block text-[0.9375rem] text-ink-subtle">{l.sub}</span>
              </span>
              <span className="shrink-0 rounded-[8px] bg-canvas px-2.5 py-1 text-[0.8125rem] font-extrabold tracking-[0.04em] text-ink-subtle">{l.cefr}</span>
            </button>
          );
        })}
      </div>
      <Link
        href="/mulai/penempatan"
        className="rise flex items-center gap-4 rounded-[18px] border-2 border-dashed border-mango-deep bg-mango-soft px-5 py-4 text-mango-ink transition-transform duration-150 active:translate-y-1 [--i:6]"
      >
        <HelpCircle className="size-7 shrink-0" aria-hidden />
        <span className="flex-1">
          <strong className="block font-display text-[1.1875rem]">Nggak yakin? Ikut tes penempatan</strong>
          <span className="text-[0.9375rem]">8 soal, sekitar 3 menit. Lori yang tentukan titik mulaimu.</span>
        </span>
        <ArrowRight className="size-5" aria-hidden />
      </Link>
    </OnboardingStep>
  );
}
