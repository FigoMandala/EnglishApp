import { Check, Lock, Star } from "lucide-react";
import Link from "next/link";

import { Lori } from "@/components/mascot";
import { cn } from "@/lib/utils";

export type UnitView = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: "basic" | "intermediate" | "advanced";
  state: "done" | "current" | "locked";
  items: { id: number; kind: "grammar" | "vocab"; title: string }[];
};

/** Pergeseran horizontal (px) tiap node: jalur berkelok seperti pada mockup. */
const ZIGZAG = [0, 64, 96, 64, 0, -64, -96, -64];

const STYLE = {
  done: "bg-primary text-white [--ledge:#145536]",
  current: "bg-primary text-white [--ledge:#145536]",
  locked: "bg-hairline text-[#8f8574] [--ledge:#c9bba2]",
} as const;

export function UnitMap({ units }: { units: UnitView[] }) {
  return (
    <ol className="mx-auto mt-16 flex w-full max-w-[680px] flex-col items-center gap-[22px] overflow-x-clip">
      {units.map((unit, i) => {
        const current = unit.state === "current";
        const locked = unit.state === "locked";
        const size = current ? 96 : 80;
        const Icon = unit.state === "done" ? Check : locked ? Lock : Star;
        const aria = `${unit.title}: ${unit.state === "done" ? "selesai" : locked ? "terkunci" : "mulai"}`;
        const node = (
          <Icon className={cn(current ? "size-10 fill-white" : "size-8")} strokeWidth={2.6} aria-hidden />
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
              <>
                <span className="bob absolute left-1/2 -top-[52px] w-24 -translate-x-1/2 rounded-[12px] border-2 border-hairline bg-surface py-2 text-center font-display text-[0.9375rem] font-black tracking-[0.04em] text-primary shadow-[0_3px_0_var(--color-hairline)]">
                  MULAI
                </span>
                <span aria-hidden className="ping absolute -inset-1.5 rounded-full border-[6px] border-mint" />
              </>
            ) : null}
            {locked ? (
              <span
                role="img"
                aria-label={aria}
                className={cn("ledge relative grid place-items-center rounded-full", STYLE.locked)}
                style={{ width: size, height: size }}
              >
                {node}
              </span>
            ) : (
              <Link
                href={`/belajar/${unit.slug}`}
                aria-label={aria}
                className={cn("ledge relative grid place-items-center rounded-full", STYLE[unit.state])}
                style={{ width: size, height: size }}
              >
                {node}
              </Link>
            )}
            </div>
            {current ? (
              <div className="absolute left-[118px] -top-[46px] hidden w-[330px] items-end gap-1 lg:flex">
                <Lori mood="wave" size={130} label="Lori duduk di samping pelajaran berikutnya, melambai" />
                <div className="pop mb-16 rounded-[16px_16px_16px_4px] border-2 border-hairline bg-surface px-3.5 py-3 text-[0.875rem] leading-[1.4] shadow-[0_3px_0_var(--color-hairline)] [animation-delay:600ms]">
                  <strong className="block text-[0.9375rem]">{unit.title}</strong>
                  {unit.description ?? "Yuk, mulai unit ini!"}
                </div>
              </div>
            ) : null}
            <span
              className={cn(
                "mt-2 w-[150px] text-center text-[0.875rem] font-bold leading-tight sm:absolute sm:left-full sm:top-1/2 sm:ml-4 sm:mt-0 sm:w-44 sm:-translate-y-1/2 sm:text-left",
                current && "lg:hidden",
                locked ? "text-ink-faint" : "text-ink-muted",
              )}
            >
              {unit.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
