"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { GaugeRing } from "@/components/charts";
import { Lori } from "@/components/mascot";
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
  title,
  meta,
  summary,
}: {
  essay: string;
  corrections: ReviewCorrection[];
  aspects: ReviewAspect[];
  total: number;
  title: string;
  meta: string;
  summary: string | null;
}) {
  const [active, setActive] = useState<number | null>(corrections.length > 0 ? 0 : null);
  const marks = useRef<Record<number, HTMLElement | null>>({});
  const items = useRef<Record<number, HTMLElement | null>>({});
  const parts = useMemo(() => segments(essay, corrections), [essay, corrections]);

  function select(index: number, from: "text" | "list") {
    setActive(index);
    (from === "list" ? marks : items).current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <>
      <section
        aria-label="Penilaian"
        className="rise flex flex-wrap items-center gap-8 rounded-[28px] border-2 border-hairline bg-surface p-7 shadow-card"
      >
        <div className="flex items-center gap-5">
          <GaugeRing
            value={Math.max(0, Math.min(100, total))}
            size={108}
            tone={total >= 70 ? "primary" : total >= 50 ? "mango" : "brick"}
            display={String(total)}
            label={`Skor total ${total} dari 100`}
          />
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[1.625rem] font-black leading-tight">{title}</h1>
            <span className="text-[0.875rem] text-ink-subtle">{meta}</span>
          </div>
        </div>
        <dl className="grid flex-[1_1_320px] grid-cols-2 gap-x-6 gap-y-3.5">
          {aspects.map((a, i) => (
            <div key={a.label}>
              <dt className="flex justify-between text-[0.875rem] font-extrabold">
                <span>{a.label}</span>
                <span className={cn("tnum", a.score < 50 && "text-brick-deep")}>{a.score}</span>
              </dt>
              <dd className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                <span
                  className={cn("grow-x block h-full rounded-full", tone(a.score))}
                  style={{ width: `${a.score}%`, animationDelay: `${i * 0.1}s` }}
                />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {summary ? (
        <div className="flex items-end gap-2">
          <Lori mood="talk" size={80} className="shrink-0" />
          <div className="mb-6 flex-1 rounded-[20px_20px_20px_6px] border-2 border-hairline bg-surface px-[18px] py-3.5 text-[0.9375rem] leading-relaxed shadow-[0_3px_0_var(--color-hairline)]">
            <strong className="block text-primary-deep">Komentar Lori</strong>
            {summary}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <article
          aria-label="Esai dengan sorotan koreksi"
          className="flex min-w-0 flex-[1.3_1_520px] flex-col gap-3.5 rounded-[28px] border-2 border-hairline bg-surface px-6 py-7 sm:px-8"
        >
          {corrections.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-extrabold text-brick-deep">
              <span className="h-2.5 w-4 rounded-[3px] border-b-[3px] border-brick bg-brick-soft" aria-hidden />
              perlu diperbaiki · klik untuk lihat koreksinya
            </span>
          ) : null}
          <p className="whitespace-pre-wrap text-[1.125rem] leading-[2]">
            {parts.map((part, i) =>
              part.index === null ? (
                <span key={i}>{part.text}</span>
              ) : (
                <span key={i}>
                  <mark
                    ref={(el) => {
                      marks.current[part.index!] = el;
                    }}
                    onClick={() => select(part.index!, "text")}
                    className={cn(
                      "cursor-pointer rounded-[4px] border-b-[3px] border-brick bg-brick-soft px-[3px] py-px text-ink",
                      active === part.index && "outline outline-[3px] outline-offset-2 outline-sky",
                    )}
                  >
                    {part.text}
                  </mark>
                  <sup className="text-[0.75rem] font-extrabold text-brick-deep">{part.index! + 1}</sup>
                </span>
              ),
            )}
          </p>
        </article>

        <aside aria-label="Daftar koreksi" className="flex min-w-[280px] flex-[1_1_340px] flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[1.25rem] font-extrabold">{corrections.length} koreksi</h2>
            <span className="text-[0.8125rem] text-ink-subtle">urut sesuai nomor</span>
          </div>
          {corrections.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {corrections.map((c, i) => (
                <li
                  key={i}
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                >
                  <button
                    type="button"
                    onClick={() => select(i, "list")}
                    aria-pressed={active === i}
                    className={cn(
                      "flex w-full cursor-pointer flex-col gap-1.5 rounded-[18px] border-2 bg-surface p-4 text-left",
                      active === i ? "border-brick shadow-[0_3px_0_var(--color-brick-line)]" : "border-hairline",
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brick text-[0.75rem] font-extrabold text-white">
                        {i + 1}
                      </span>
                      <strong className="text-[0.9375rem]">
                        <s className="text-brick-deep">{c.original}</s> → <span className="text-primary-deep">{c.correction}</span>
                      </strong>
                    </span>
                    <span className="text-[0.875rem] text-ink-muted">{c.reason}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[16px] bg-primary-soft px-4 py-3.5 text-[0.9375rem] font-semibold text-primary-deep">
              Tidak ada kalimat yang perlu dikoreksi. Bagus!
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-2.5">
            <Link
              href="/writing"
              className="flex h-[50px] flex-1 items-center justify-center rounded-[16px] bg-primary font-display text-[0.9375rem] font-extrabold text-white shadow-[0_5px_0_var(--color-primary-deep)] transition-transform active:translate-y-[5px] active:shadow-none"
            >
              TULIS ULANG
            </Link>
            <Link
              href="/latihan/kesalahan"
              className="flex h-[50px] flex-1 items-center justify-center rounded-[16px] border-2 border-hairline bg-surface font-display text-[0.9375rem] font-extrabold text-ink shadow-card"
            >
              Latih pola ini
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
