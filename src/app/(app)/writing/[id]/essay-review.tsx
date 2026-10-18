"use client";

import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type ReviewCorrection = { original: string; correction: string; reason: string };
export type ReviewAspect = { label: string; score: number };

type Segment = { text: string; index: number | null };

/** Pecah esai menjadi potongan; kalimat yang cocok dengan koreksi diberi indeks. */
function segments(essay: string, corrections: ReviewCorrection[]): Segment[] {
  const found = corrections
    .map((c, index) => ({ index, at: essay.indexOf(c.original), len: c.original.length }))
    .filter((c) => c.at >= 0 && c.len > 0)
    .sort((a, b) => a.at - b.at);
  const out: Segment[] = [];
  let cursor = 0;
  for (const c of found) {
    if (c.at < cursor) continue; // tumpang tindih: lewati
    if (c.at > cursor) out.push({ text: essay.slice(cursor, c.at), index: null });
    out.push({ text: essay.slice(c.at, c.at + c.len), index: c.index });
    cursor = c.at + c.len;
  }
  if (cursor < essay.length) out.push({ text: essay.slice(cursor), index: null });
  return out;
}

const tone = (n: number) => (n >= 70 ? "bg-primary" : n >= 50 ? "bg-mango" : "bg-brick");

export function EssayReview({
  essay,
  corrections,
  aspects,
  total,
}: {
  essay: string;
  corrections: ReviewCorrection[];
  aspects: ReviewAspect[];
  total: number;
}) {
  const [active, setActive] = useState<number | null>(corrections.length > 0 ? 0 : null);
  const marks = useRef<Record<number, HTMLElement | null>>({});
  const parts = useMemo(() => segments(essay, corrections), [essay, corrections]);

  const R = 46;
  const C = 2 * Math.PI * R;

  function select(index: number) {
    setActive(index);
    marks.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <article
        aria-label="Esai dengan sorotan koreksi"
        className="rise relative min-w-0 flex-1 rounded-[24px] border-2 border-hairline bg-[#fffdf8] px-6 py-7 font-serif text-[1.25rem] leading-[1.75] shadow-[0_5px_0_var(--color-hairline)] sm:px-9 sm:text-[1.3125rem]"
      >
        <p className="whitespace-pre-wrap">
          {parts.map((part, i) =>
            part.index === null ? (
              <span key={i}>{part.text}</span>
            ) : (
              <mark
                key={i}
                ref={(el) => {
                  marks.current[part.index!] = el;
                }}
                onClick={() => select(part.index!)}
                className={cn(
                  "cursor-pointer rounded-[4px] border-b-[3px] border-brick bg-[#f8cfc3] px-0.5 text-ink transition-shadow",
                  active === part.index && "outline outline-[3px] outline-offset-2 outline-sky",
                )}
              >
                {part.text}
              </mark>
            ),
          )}
        </p>
        <p className="mt-5 border-t-2 border-dashed border-hairline pt-3.5 font-sans text-[0.875rem] font-bold text-ink-subtle">
          {essay.trim().split(/\s+/).filter(Boolean).length} kata · {corrections.length} kalimat dikoreksi
        </p>
      </article>

      <aside aria-label="Penilaian dan komentar" className="flex w-full flex-col gap-3.5 lg:w-[380px] lg:shrink-0">
        <div className="rise flex items-center gap-[18px] rounded-[22px] border-2 border-hairline bg-surface p-5 shadow-[0_4px_0_var(--color-hairline)]">
          <svg viewBox="0 0 110 110" width="110" height="110" role="img" aria-label={`Skor total ${total} dari 100`} className="shrink-0">
            <circle cx="55" cy="55" r={R} fill="none" stroke="var(--color-canvas-deep)" strokeWidth="10" />
            <circle
              cx="55"
              cy="55"
              r={R}
              fill="none"
              stroke={total >= 70 ? "var(--color-primary)" : total >= 50 ? "var(--color-mango)" : "var(--color-brick)"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C - (Math.max(0, Math.min(100, total)) / 100) * C}
              transform="rotate(-90 55 55)"
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" }}
            />
            <text x="55" y="60" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="900" fontSize="32" fill="#1B1F22">
              {total}
            </text>
            <text x="55" y="78" textAnchor="middle" fontWeight="700" fontSize="12" fill="#5B6268">
              dari 100
            </text>
          </svg>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.25rem] font-black">Skor total</p>
            <ul className="mt-2.5 flex flex-col gap-2">
              {aspects.map((a, i) => (
                <li key={a.label} className="grid grid-cols-[84px_1fr_28px] items-center gap-2 text-[0.8125rem] font-bold">
                  <span className="truncate">{a.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#f1ece2]">
                    <span className={cn("grow-x block h-full rounded-full", tone(a.score))} style={{ width: `${a.score}%`, animationDelay: `${i * 0.1}s` }} />
                  </span>
                  <span className="text-right tabular-nums">{a.score}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {corrections.length > 0 ? (
          <>
            <ul className="rise flex flex-col gap-2.5 [--i:2]">
              {corrections.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => select(i)}
                    aria-pressed={active === i}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 rounded-[16px] border-2 bg-surface px-4 py-3.5 text-left shadow-[0_3px_0_var(--color-hairline)] transition-[transform,box-shadow] active:translate-y-[3px] active:shadow-none",
                      active === i ? "border-sky" : "border-hairline",
                    )}
                  >
                    <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-[3px] bg-brick" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-extrabold">
                        <span className="text-ink-subtle line-through decoration-brick decoration-2">{c.original}</span>
                        <span className="block text-primary-deep">{c.correction}</span>
                      </span>
                      <span className="mt-1 block text-[0.875rem] leading-snug text-ink-subtle">{c.reason}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-[16px] bg-primary-soft px-4 py-3.5 text-[0.9375rem] font-semibold text-primary-deep">
            Tidak ada kalimat yang perlu dikoreksi. Bagus!
          </p>
        )}
      </aside>
    </div>
  );
}
