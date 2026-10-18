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
  hotel: { Icon: Building2, tone: "bg-[#e5f3f3] text-[#165e5e]" },
  makan: { Icon: Utensils, tone: "bg-brick-soft text-brick-deep" },
  smalltalk: { Icon: MessageCircle, tone: "bg-[#f1e8f7] text-[#5d2e86]" },
};

export function ScenarioPicker({ scenarios }: { scenarios: Scenario[] }) {
  const [sel, setSel] = useState(0);
  const [correction, setCorrection] = useState<"live" | "end">("live");
  const cur = scenarios[sel];

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-[18px]">
        <div className="rise">
          <p className="text-[0.875rem] font-extrabold tracking-[0.08em] text-[#17603c]">TUTOR AI</p>
          <h1 className="mt-1 font-display text-[2.25rem] font-black tracking-[-0.03em] sm:text-[2.625rem]">Mau ngobrol soal apa hari ini?</h1>
          <p className="mt-1.5 text-[1.0625rem] text-ink-subtle">
            Lori memerankan lawan bicaramu. Kamu bisa minta ulang, pelan, atau terjemahan kapan saja.
          </p>
        </div>

        <div role="radiogroup" aria-label="Skenario" className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
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
                  "rise lift flex min-h-[196px] cursor-pointer flex-col items-start gap-2 rounded-[22px] border-2 p-[18px] text-left transition-[transform,box-shadow] active:translate-y-1 active:shadow-none",
                  on ? "border-primary bg-[#eaf5ee] shadow-[0_5px_0_var(--color-primary)]" : "border-hairline bg-surface shadow-[0_5px_0_var(--color-hairline)]",
                )}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className={cn("grid size-16 place-items-center rounded-[20px]", tone)}>
                  <Icon className="size-8" aria-hidden />
                </span>
                <span className="font-display text-[1.1875rem] font-black">{s.title}</span>
                <span className="flex-1 text-[0.875rem] leading-snug text-ink-subtle">{s.desc}</span>
                <span className="flex flex-wrap gap-1.5">
                  <span className="rounded-[8px] bg-canvas px-2 py-0.5 text-[0.75rem] font-extrabold text-ink-subtle">{s.level}</span>
                  <span className="rounded-[8px] bg-canvas px-2 py-0.5 text-[0.75rem] font-extrabold text-ink-subtle">{s.minutes}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside
        key={cur.id}
        aria-live="polite"
        aria-label="Ringkasan sesi"
        className="rise flex w-full flex-col gap-3.5 rounded-[26px] border-2 border-hairline bg-surface p-[22px] shadow-[0_5px_0_var(--color-hairline)] lg:w-[400px] lg:shrink-0"
      >
        <div className="flex items-end gap-3">
          <Lori mood="talk" size={120} className="shrink-0" />
          <div className="pop mb-7 flex-1 rounded-[16px_16px_16px_4px] bg-canvas px-3.5 py-3 text-[0.9375rem] font-bold leading-snug">“{cur.opener}”</div>
        </div>
        <div>
          <p className="text-[0.8125rem] font-extrabold tracking-[0.08em] text-ink-subtle">LORI JADI</p>
          <h2 className="mt-0.5 font-display text-[1.5rem] font-black">{cur.persona}</h2>
        </div>
        <div>
          <p className="mb-2 text-[0.8125rem] font-extrabold tracking-[0.08em] text-ink-subtle">MISI SESI</p>
          <ul className="flex flex-col gap-2">
            {cur.goals.map((g) => (
              <li key={g} className="flex items-start gap-2.5 text-[0.9375rem]">
                <span aria-hidden className="mt-0.5 size-5 shrink-0 rounded-[6px] border-2 border-[#9fd0b3]" />
                {g}
              </li>
            ))}
          </ul>
        </div>
        <fieldset className="flex flex-col gap-1.5 border-t-2 border-dashed border-hairline pt-3">
          <legend className="mb-1.5 text-[0.9375rem] font-extrabold">Koreksi kesalahan</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode koreksi">
            {(
              [
                { id: "live", label: "Langsung", sub: "dikoreksi tiap kalimat" },
                { id: "end", label: "Di akhir sesi", sub: "biar ngobrol nggak putus" },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={correction === c.id}
                onClick={() => setCorrection(c.id)}
                className={cn(
                  "min-h-[52px] cursor-pointer rounded-[14px] border-2 px-2.5 py-1.5 text-left text-[0.875rem] font-extrabold leading-tight",
                  correction === c.id ? "border-primary bg-[#eaf5ee]" : "border-hairline bg-surface",
                )}
              >
                {c.label}
                <span className="block text-[0.75rem] font-semibold text-ink-subtle">{c.sub}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Link
          href={`/tutor/skenario/${cur.id}?c=${correction}`}
          className="ledge flex min-h-[58px] items-center justify-center rounded-[16px] bg-primary font-display text-[1.1875rem] font-black text-white"
        >
          MULAI NGOBROL
        </Link>
      </aside>
    </div>
  );
}
