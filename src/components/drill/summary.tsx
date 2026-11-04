"use client";

import { Confetti } from "@/components/fx/confetti";
import { Lori } from "@/components/mascot";
import { cn } from "@/lib/utils";

import { DrillFooter, DrillMain, DrillPage, PrimaryLink, SecondaryButton } from "./parts";

/** `bg` = warna strip judul (mis. "bg-mango"), `ink` = warna angka. */
export type SummaryStat = { label: string; value: string | number; bg: string; ink: string };

const BOX: Record<string, string> = {
  "bg-mango": "border-mango-line bg-mango-soft",
  "bg-primary": "border-primary-line bg-primary-soft",
  "bg-sky": "border-sky-line bg-sky-soft",
  "bg-brick": "border-brick-line bg-brick-soft",
};

/** Layar akhir mode latihan: Lori bersorak, kotak statistik, tombol lanjut. */
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
      <DrillMain className="relative flex flex-col items-center gap-6 overflow-hidden pt-14 text-center">
        <Confetti count={40} />
        <div aria-hidden className="absolute left-1/2 top-10 size-[480px] -translate-x-1/2 rounded-full bg-canvas-deep" />
        <Lori mood="cheer" size={200} label="Lori melompat gembira" className="relative" />
        <div className="pop relative [--i:3]">
          <h1 className="font-display text-[2.5rem] font-black leading-[1.05] tracking-[-0.03em] sm:text-[3rem]">{title}</h1>
          <p className="mt-1.5 text-[1.125rem] text-ink-muted">{subtitle}</p>
        </div>
        <ul
          className="relative grid w-full gap-3.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}
        >
          {stats.map((s, i) => (
            <li
              key={s.label}
              className={cn("pop overflow-hidden rounded-plate border-2", BOX[s.bg] ?? "border-hairline bg-surface")}
              style={{ "--i": 4 + i } as React.CSSProperties}
            >
              <p className={cn("py-1.5 text-[0.75rem] font-extrabold tracking-[0.08em]", s.bg, s.bg === "bg-mango" ? "text-mango-on" : "text-white")}>
                {s.label}
              </p>
              <p className={cn("px-2 py-4 font-round text-[2rem] font-extrabold leading-none", s.ink)}>{s.value}</p>
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
