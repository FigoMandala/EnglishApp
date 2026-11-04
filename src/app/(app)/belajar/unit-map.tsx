import { Check, Lock, Star } from "lucide-react";
import Link from "next/link";

import { Lori } from "@/components/mascot";
import { cn } from "@/lib/utils";

export type UnitView = {
  id: number;
  order: number;
  slug: string;
  title: string;
  description: string | null;
  level: "basic" | "intermediate" | "advanced";
  state: "done" | "current" | "locked";
  /** Langkah tersisa di unit berjalan. */
  remaining: number;
};

/** Pergeseran horizontal (px) tiap node: jalur berkelok. */
const ZIGZAG = [0, 70, 104, 70, 0, -70, -104, -70];

export function UnitMap({ units }: { units: UnitView[] }) {
  return (
    <ol className="mx-auto flex w-full max-w-[620px] flex-col items-center gap-7 overflow-x-clip pb-6 pt-14">
      {units.map((unit, i) => {
        const current = unit.state === "current";
        const locked = unit.state === "locked";
        const aria = `Unit ${unit.order}, ${unit.title}: ${unit.state === "done" ? "selesai" : locked ? "terkunci" : "sedang berjalan"}`;
        const Icon = unit.state === "done" ? Check : locked ? Lock : Star;
        const node = (
          <Icon
            className={cn(current ? "size-10 fill-white" : "size-7")}
            strokeWidth={current ? 2 : unit.state === "done" ? 3 : 2.6}
            aria-hidden
          />
        );
        return (
          <li
            key={unit.id}
            aria-current={current ? "step" : undefined}
            className="rise relative flex flex-col items-center left-[calc(var(--dx)*0.45)] sm:left-[var(--dx)]"
            style={{ "--dx": `${ZIGZAG[i % ZIGZAG.length]}px`, "--i": i } as React.CSSProperties}
          >
            <div className="relative">
              {current ? (
                <span className="bob absolute -top-[46px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[12px] border-2 border-hairline bg-surface px-3.5 py-1.5 font-display text-[0.875rem] font-black tracking-[0.04em] text-primary shadow-[0_3px_0_var(--color-hairline)]">
                  LANJUT
                </span>
              ) : null}
              {locked ? (
                <span
                  role="img"
                  aria-label={aria}
                  className="grid size-20 place-items-center rounded-full bg-locked text-ink-faint shadow-[0_5px_0_var(--color-locked-ledge)]"
                >
                  {node}
                </span>
              ) : (
                <Link
                  href={`/belajar/${unit.slug}`}
                  aria-label={aria}
                  className={cn(
                    "grid place-items-center rounded-full bg-primary text-white transition-transform active:translate-y-1",
                    current
                      ? "size-24 shadow-[0_0_0_6px_var(--color-canvas),0_0_0_11px_var(--color-mint),0_6px_0_11px_var(--color-primary-deep)]"
                      : "size-20 shadow-[0_5px_0_var(--color-primary-deep)]",
                  )}
                >
                  {node}
                </Link>
              )}
            </div>
            {current ? (
              <div className="absolute -top-10 left-[124px] hidden w-[300px] items-end lg:flex">
                <Lori mood="wave" size={112} label="Lori melambai di samping unit sekarang" />
                <div
                  className="pop mb-14 rounded-[16px_16px_16px_4px] border-2 border-hairline bg-surface px-3 py-2.5 text-[0.8125rem] leading-[1.4] shadow-[0_3px_0_var(--color-hairline)]"
                  style={{ "--delay": "600ms" } as React.CSSProperties}
                >
                  <strong className="block text-[0.875rem]">
                    {unit.remaining > 0 ? `Tinggal ${unit.remaining} langkah` : unit.title}
                  </strong>
                  Selesaikan unit ini: +30 XP
                </div>
              </div>
            ) : null}
            <span
              className={cn(
                "mt-2 w-[150px] text-center text-[0.875rem] font-bold leading-tight sm:absolute sm:left-full sm:top-1/2 sm:ml-5 sm:mt-0 sm:w-44 sm:-translate-y-1/2 sm:text-left",
                current && "lg:hidden",
                locked ? "text-ink-subtle" : "text-ink-subtle",
              )}
            >
              Unit {unit.order}
              <strong className={cn("block", locked ? "text-ink-muted" : "text-ink")}>{unit.title}</strong>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
