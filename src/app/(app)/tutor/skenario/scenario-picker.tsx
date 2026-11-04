"use client";

import { Briefcase, Building2, GraduationCap, MessageCircle, Presentation, Utensils, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Lori } from "@/components/mascot";
import type { Scenario } from "@/lib/tutor-scenarios";
import { cn } from "@/lib/utils";

const ICONS: Record<string, { Icon: LucideIcon; tone: string }> = {
  interview: { Icon: Briefcase, tone: "bg-primary-soft text-primary-deep" },
  beasiswa: { Icon: GraduationCap, tone: "bg-mango-soft text-mango-ink" },
  presentasi: { Icon: Presentation, tone: "bg-sky-soft text-sky-deep" },
  hotel: { Icon: Building2, tone: "bg-sky-soft text-sky-deep" },
  makan: { Icon: Utensils, tone: "bg-brick-soft text-brick-deep" },
  smalltalk: { Icon: MessageCircle, tone: "bg-mango-soft text-mango-ink" },
};

export function ScenarioPicker({ scenarios }: { scenarios: Scenario[] }) {
  const [sel, setSel] = useState(0);
  const [correction, setCorrection] = useState<"live" | "end">("live");
  const cur = scenarios[sel];
  const activeIndex = correction === "live" ? 0 : 1;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <header className="rise flex flex-col gap-1.5">
        <p className="eyebrow text-ink-subtle">Tutor AI · skenario</p>
        <h1 className="font-display text-[2.25rem] font-black leading-[1.1] tracking-[-0.02em]">Mau ngobrol soal apa hari ini?</h1>
        <p className="text-ink-subtle">Lori memerankan lawan bicara. Kamu dapat misi kecil dan ringkasan koreksi di akhir.</p>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <div role="radiogroup" aria-label="Skenario" className="grid min-w-0 flex-[1_1_520px] gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {scenarios.map((s, i) => {
            const on = i === sel;
            const { Icon, tone } = ICONS[s.id] ?? ICONS.smalltalk;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSel(i)}
                className={cn(
                  "rise flex min-h-[150px] cursor-pointer flex-col items-start gap-2 rounded-[22px] border-2 p-[18px] text-left transition-transform active:translate-y-1 active:shadow-none",
                  on ? "border-primary bg-primary-soft shadow-[0_4px_0_var(--color-primary)]" : "border-hairline bg-surface shadow-card",
                )}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className={cn("grid size-9 place-items-center rounded-[12px]", tone)}>
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn("rounded-chip px-2.5 py-0.5 text-[0.75rem] font-extrabold", on ? "bg-surface text-primary-deep" : "bg-canvas text-ink-subtle")}>
                      {s.level}
                    </span>
                    <span className="text-[0.75rem] font-extrabold text-ink-subtle">{s.minutes}</span>
                  </span>
                </span>
                <strong className="font-display text-[1.1875rem] leading-tight">{s.title}</strong>
                <span className="text-[0.875rem] text-ink-subtle">{s.desc}</span>
              </button>
            );
          })}
        </div>

        <aside
          key={cur.id}
          aria-live="polite"
          aria-label="Ringkasan sesi"
          className="rise flex min-w-[280px] flex-[0_1_360px] flex-col gap-[18px] rounded-[28px] border-2 border-hairline bg-surface p-6 shadow-card"
        >
          <div className="flex items-end gap-2">
            <Lori mood="talk" size={80} className="shrink-0" />
            <div className="mb-5">
              <span className="eyebrow block text-primary-deep">Lori jadi</span>
              <strong className="font-display text-[1.25rem] leading-tight">{cur.persona}</strong>
            </div>
          </div>
          <p className="rounded-[16px_16px_16px_4px] bg-canvas px-3.5 py-3 text-[0.9375rem] font-bold leading-snug">“{cur.opener}”</p>
          <div className="flex flex-col gap-2">
            <span className="eyebrow text-ink-subtle">Misi sesi</span>
            <ul className="flex flex-col gap-2">
              {cur.goals.map((g) => (
                <li key={g} className="flex items-start gap-2.5 text-[0.9375rem]">
                  <span aria-hidden className="mt-0.5 size-[22px] shrink-0 rounded-[7px] border-2 border-primary-line bg-primary-soft" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <span id="s-koreksi" className="eyebrow text-ink-subtle">Koreksi kesalahan</span>
            <div role="group" aria-labelledby="s-koreksi" className="relative flex gap-1 rounded-[14px] bg-surface-sunken p-1">
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 w-[calc(50%-0.75rem)] rounded-[10px] bg-surface shadow-[0_2px_0_var(--color-hairline-strong)] transition-transform duration-200 ease-out"
                style={{ transform: `translateX(calc(${activeIndex} * (100% + 4px)))` }}
              />
              {(
                [
                  { id: "live", label: "Langsung" },
                  { id: "end", label: "Di akhir sesi" },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={correction === c.id}
                  onClick={() => setCorrection(c.id)}
                  className={cn(
                    "relative z-10 h-10 flex-1 cursor-pointer rounded-[10px] text-[0.875rem] font-extrabold transition-colors duration-200",
                    correction === c.id ? "text-ink" : "text-ink-muted",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <span className="text-[0.8125rem] text-ink-subtle">
              {correction === "live" ? "Lori membetulkan tiap kalimat yang keliru." : "Ngobrol tanpa jeda, koreksi dirangkum di akhir."}
            </span>
          </div>
          <Link
            href={`/tutor/skenario/${cur.id}?c=${correction}`}
            className="flex h-[54px] items-center justify-center rounded-[16px] bg-primary font-display text-base font-extrabold tracking-[0.03em] text-white shadow-[0_5px_0_var(--color-primary-deep)] transition-transform active:translate-y-[5px] active:shadow-none"
          >
            MULAI NGOBROL
          </Link>
        </aside>
      </div>
    </div>
  );
}
