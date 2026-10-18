"use client";

import { Confetti } from "@/components/fx/confetti";
import { Kaka, Lori } from "@/components/mascot";
import { cn } from "@/lib/utils";

import { DrillFooter, DrillMain, DrillPage, PrimaryLink, SecondaryButton } from "./parts";

export type SummaryStat = { label: string; value: string | number; bg: string; ink: string };

/** Layar akhir mode latihan: Lori + Kaka, empat kotak statistik, tombol lanjut. */
export function DrillSummary({
  title = "Latihan beres!",
  subtitle,
  stats,
  onAgain,
  nextHref = "/latihan",
  nextLabel = "KEMBALI KE LATIHAN",
}: {
  title?: string;
  subtitle: string;
  stats: SummaryStat[];
  onAgain?: () => void;
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <DrillPage>
      <DrillMain className="relative flex flex-col items-center gap-6 pt-10">
        <Confetti count={40} />
        <div className="relative flex h-[240px] items-end justify-center gap-10">
          <Lori mood="cheer" size={220} label="Lori melompat gembira" />
          <Kaka mood="proud" size={150} label="Kaka bangga" className="mb-2" />
        </div>
        <div className="pop text-center [--i:3]">
          <h1 className="font-display text-[2.5rem] font-black tracking-[-0.035em] text-primary sm:text-[3.5rem]">{title}</h1>
          <p className="mt-1.5 text-[1.1875rem] text-ink-subtle">{subtitle}</p>
        </div>
        <ul className="grid w-full max-w-[860px] grid-cols-2 gap-3.5 sm:grid-cols-4">
          {stats.map((s, i) => (
            <li key={s.label} className={cn("pop overflow-hidden rounded-[20px] p-[3px]", s.bg)} style={{ "--i": 4 + i } as React.CSSProperties}>
              <p className="py-2 text-center text-[0.8125rem] font-black tracking-[0.08em] text-white">{s.label}</p>
              <p className={cn("rounded-t-[16px] bg-surface px-2 py-4 text-center font-display text-[1.875rem] font-black", s.ink)}>
                {s.value}
              </p>
            </li>
          ))}
        </ul>
      </DrillMain>
      <DrillFooter>
        {onAgain ? <SecondaryButton onClick={onAgain}>ULANGI</SecondaryButton> : <span />}
        <PrimaryLink href={nextHref} autoFocus>
          {nextLabel}
        </PrimaryLink>
      </DrillFooter>
    </DrillPage>
  );
}
