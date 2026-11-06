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
    <ol className="mx-auto flex w-full max-w-[620px] flex-col items-center gap-7 pb-6 pt-14">
      {units.map((unit, i) => {
        const current = unit.state === "current";
        const locked = unit.state === "locked";
        const dx = ZIGZAG[i % ZIGZAG.length];
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
            style={{ "--dx": `${dx}px`, "--i": i } as React.CSSProperties}
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
              <>
                {/* Lori selalu di kanan node; bubble dipindah ke sisi yang dijamin
                    muat supaya tidak terpotong tepi kontainer jalur. */}
                <Lori
                  mood="wave"
                  size={112}
                  label="Lori melambai di samping unit sekarang"
                  className="absolute bottom-1 left-[calc(100%+8px)] hidden lg:block"
                />
                <div
                  className={cn(
                    "pop absolute bottom-10 hidden border-2 border-hairline bg-surface px-3 py-2.5 text-[0.8125rem] leading-[1.4] shadow-[0_3px_0_var(--color-hairline)] lg:block",
                    dx >= 0
                      ? "right-[calc(100%+8px)] w-[230px] rounded-[16px_16px_4px_16px]"
                      : "left-[calc(100%+118px)] w-[200px] rounded-[16px_16px_16px_4px]",
                  )}
                  style={{ "--delay": "600ms" } as React.CSSProperties}
                >
                  <strong className="block text-[0.875rem]">
                    {unit.remaining > 0 ? `Tinggal ${unit.remaining} langkah` : unit.title}
                  </strong>
                  Selesaikan unit ini: +30 XP
                </div>
              </>
            ) : null}
            {/* Label samping baru aman di lg+ (margin kontainer cukup); di bawah
                itu label di bawah node — di 640-767px label samping terpotong
                overflow-x-clip halaman. */}
            <span
              className={cn(
                "mt-2 w-[150px] text-center text-[0.875rem] font-bold leading-tight lg:absolute lg:left-full lg:top-1/2 lg:ml-5 lg:mt-0 lg:w-44 lg:-translate-y-1/2 lg:text-left",
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
