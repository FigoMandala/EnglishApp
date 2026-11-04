"use client";

import { Flame } from "lucide-react";
import { useEffect, useState } from "react";

import { DAILY_MINUTES, loadOnboarding, saveOnboarding, type DailyMinutes } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { CHOICE, OnboardingStep } from "../step-layout";

const OPTS: Record<DailyMinutes, { label: string; flames: number; t: string; b: string }> = {
  5: { label: "Santai", flames: 1, t: "Santai juga boleh…", b: "Lima menit itu cukup buat jaga streak. Tapi jangan kaget kalau ketagihan." },
  10: { label: "Normal", flames: 2, t: "Pilihan paling pas!", b: "Satu pelajaran plus ulang kosakata. Cocok buat sela-sela kuliah." },
  15: { label: "Serius", flames: 3, t: "Wih, semangat!", b: "Cukup buat satu pelajaran dan satu paket soal EPrT pendek tiap hari." },
  20: { label: "Ngebut", flames: 4, t: "Gas pol!", b: "Mode persiapan ujian. Kaka udah siap jadi pelatih galakmu." },
};

export default function TargetPage() {
  const [picked, setPicked] = useState<DailyMinutes>(10);
  useEffect(() => setPicked(loadOnboarding().dailyMinutes), []);
  const cur = OPTS[picked];

  return (
    <OnboardingStep
      step={3}
      backHref="/mulai/level"
      mood={picked >= 15 ? "cheer" : picked === 5 ? "sad" : "idle"}
      hop={picked >= 15}
      bubble={{ title: cur.t, body: cur.b }}
      canNext
      nextHref="/mulai/penempatan"
      onNext={() => saveOnboarding({ dailyMinutes: picked })}
      nextLabel="LANJUT"
    >
      <div className="rise">
        <h1 className="font-display text-[1.625rem] font-black leading-[1.15] tracking-[-0.02em] sm:text-[2.75rem] sm:leading-[1.05]">Sehari mau berapa menit?</h1>
        <p className="mt-1 text-[0.875rem] text-ink-subtle sm:mt-2.5 sm:text-[1.125rem]">Kecil tapi rutin lebih ampuh daripada maraton seminggu sekali.</p>
      </div>
      <div role="radiogroup" aria-label="Target harian" className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {DAILY_MINUTES.map((min, i) => {
          const o = OPTS[min];
          const sel = min === picked;
          return (
            <button
              key={min}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => {
                setPicked(min);
                saveOnboarding({ dailyMinutes: min });
              }}
              className={cn(
                CHOICE,
                "flex-col gap-2 px-3 pb-[18px] pt-[22px]",
                sel ? "border-primary bg-primary-soft shadow-[0_4px_0_var(--color-primary)]" : "border-hairline bg-surface shadow-[0_4px_0_var(--color-hairline)]",
              )}
              style={{ "--i": i } as React.CSSProperties}
            >
              <span aria-hidden className="flex h-[26px] items-end gap-0.5">
                {Array.from({ length: o.flames }, (_, f) => (
                  <Flame key={f} className="size-5" style={{ color: sel ? "var(--color-mango)" : "var(--color-hairline-strong)", fill: sel ? "var(--color-mango)" : "var(--color-hairline-strong)" }} />
                ))}
              </span>
              <span className="font-display text-[2.5rem] font-black leading-none tracking-[-0.02em]">{min}</span>
              <span className="text-[0.875rem] font-bold text-ink-subtle">menit / hari</span>
              <span className={cn("mt-1 rounded-full px-3 py-1 text-[0.875rem] font-extrabold", sel ? "bg-primary text-white" : "bg-canvas text-ink-subtle")}>
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="rise rounded-[14px] border-2 border-hairline bg-surface-muted px-[18px] py-3.5 text-[1rem] text-ink-subtle [--i:4]">
        Itu <strong className="text-ink">{picked * 7} menit per minggu</strong>. Kamu bisa mengubahnya kapan saja.
      </p>
    </OnboardingStep>
  );
}
