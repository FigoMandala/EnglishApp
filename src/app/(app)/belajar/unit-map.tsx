"use client";

import { CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Loader2 } from "lucide-react";

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

const LEVEL_LABEL = { basic: "Dasar", intermediate: "Menengah", advanced: "Lanjut" } as const;

export function UnitMap({ units }: { units: UnitView[] }) {
  return (
    <ol className="mx-auto flex max-w-2xl flex-col gap-2">
      {units.map((unit) => (
        <UnitNode key={unit.id} unit={unit} />
      ))}
    </ol>
  );
}

function UnitNode({ unit }: { unit: UnitView }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const locked = unit.state === "locked";

  function open() {
    if (locked || opening) return;
    setOpening(true);
    router.push(`/belajar/${unit.slug}`);
  }

  return (
    <li aria-current={unit.state === "current" ? "step" : undefined}>
      <button
        type="button"
        onClick={open}
        disabled={locked}
        className={cn(
          "group flex w-full items-center gap-4 rounded-plate border-2 p-4 text-left transition-all",
          unit.state === "done" && "border-hairline bg-surface shadow-card hover:border-primary",
          unit.state === "current" &&
            "border-primary bg-primary-soft shadow-card ring-2 ring-primary/25 hover:-translate-y-0.5",
          locked && "cursor-not-allowed border-dashed border-hairline-strong bg-surface-muted opacity-70",
        )}
      >
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full border-2",
            unit.state === "done" && "border-primary bg-primary text-white",
            unit.state === "current" && "border-primary bg-white text-primary",
            locked && "border-hairline-strong bg-canvas-deep text-ink-faint",
          )}
        >
          {unit.state === "done" ? (
            <CheckCircle2 className="size-6" aria-hidden />
          ) : locked ? (
            <Lock className="size-5" aria-hidden />
          ) : opening ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <PlayCircle className="size-6" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-[1.0625rem] font-extrabold text-ink">{unit.title}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide",
                unit.level === "basic" && "bg-primary-soft text-primary-deep",
                unit.level === "intermediate" && "bg-data-soft text-data",
                unit.level === "advanced" && "bg-warning-soft text-warning-ink",
              )}
            >
              {LEVEL_LABEL[unit.level]}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[0.875rem] text-ink-subtle">{unit.description}</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {unit.items.map((item) => (
              <span
                key={item.id}
                className={cn(
                  "rounded-[8px] px-2 py-0.5 text-[0.6875rem] font-semibold",
                  item.kind === "grammar" ? "bg-surface-muted text-ink-subtle" : "bg-data-soft text-data",
                )}
              >
                {item.kind === "vocab" ? "Kosakata" : "Materi"}
              </span>
            ))}
          </span>
        </span>
        {locked ? <span className="shrink-0 text-[0.8125rem] font-semibold text-ink-faint">Terkunci</span> : null}
      </button>
    </li>
  );
}
