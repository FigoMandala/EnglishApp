"use client";

import Link from "next/link";
import { useState } from "react";

import { Lori } from "@/components/mascot";
import type { MistakeGroup } from "@/db/queries/drills";
import { cn } from "@/lib/utils";

const TONES = [
  { c: "bg-brick", soft: "bg-brick-soft", ink: "text-brick-deep", bc: "border-brick" },
  { c: "bg-mango", soft: "bg-mango-soft", ink: "text-mango-ink", bc: "border-mango" },
  { c: "bg-sky", soft: "bg-sky-soft", ink: "text-sky-deep", bc: "border-sky" },
  { c: "bg-[#8c5bb5]", soft: "bg-[#f1e8f7]", ink: "text-[#5d2e86]", bc: "border-[#8c5bb5]" },
];

export function MistakeBank({
  groups,
  openTotal,
  correctTotal,
}: {
  groups: MistakeGroup[];
  openTotal: number;
  correctTotal: number;
}) {
  const [sel, setSel] = useState(0);
  const cur = groups[sel];

  if (groups.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Lori mood="cheer" size={180} label="Lori bersorak" />
        <h1 className="font-display text-[2.25rem] font-black tracking-[-0.03em]">Bank Kesalahan kosong</h1>
        <p className="max-w-md text-[1.0625rem] text-ink-subtle">
          Belum ada jawaban salah yang menunggu. Setiap kesalahan baru akan masuk ke sini, dikelompokkan per pola.
        </p>
        <Link href="/latihan" className="ledge flex min-h-14 items-center rounded-[16px] bg-primary px-7 font-display text-[1.1875rem] font-extrabold text-white">
          KEMBALI KE LATIHAN
        </Link>
      </div>
    );
  }

  const tone = TONES[sel % TONES.length];

  return (
    <div className="flex flex-col gap-5">
      <div className="rise flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-[2.25rem] font-black tracking-[-0.03em] sm:text-[2.625rem]">Bank Kesalahan</h1>
          <p className="mt-1.5 text-[1.0625rem] text-ink-subtle">
            Setiap jawaban salah masuk ke sini, dikelompokkan per pola. Bukan daftar dosa, ini peta.
          </p>
        </div>
        <div className="flex gap-2.5">
          <div className="rounded-[16px] border-2 border-hairline bg-surface px-4 py-3 text-center">
            <p className="font-display text-[1.625rem] font-black text-brick-deep">{openTotal}</p>
            <p className="text-[0.8125rem] font-extrabold text-ink-subtle">belum ditebus</p>
          </div>
          <div className="rounded-[16px] border-2 border-hairline bg-surface px-4 py-3 text-center">
            <p className="font-display text-[1.625rem] font-black text-primary-deep">{correctTotal}</p>
            <p className="text-[0.8125rem] font-extrabold text-ink-subtle">soal benar</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <section aria-label="Pola kesalahan" className="flex w-full flex-col gap-3 lg:w-[420px] lg:shrink-0">
          {groups.map((g, i) => {
            const t = TONES[i % TONES.length];
            const mastery = g.total > 0 ? Math.round(((g.total - g.open) / g.total) * 100) : 0;
            const active = i === sel;
            return (
              <button
                key={g.key}
                type="button"
                aria-pressed={active}
                onClick={() => setSel(i)}
                className={cn(
                  "rise flex cursor-pointer flex-col gap-2.5 rounded-[20px] border-2 bg-surface px-[18px] py-4 text-left transition-[transform,box-shadow] active:translate-y-1 active:shadow-none",
                  active ? cn(t.bc, "shadow-[0_4px_0_currentColor]") : "border-hairline shadow-[0_4px_0_var(--color-hairline)]",
                  active && t.ink,
                )}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="flex w-full items-center gap-3 text-ink">
                  <span className={cn("grid size-11 shrink-0 place-items-center rounded-[14px] font-display text-[1.0625rem] font-black", t.soft, t.ink)}>
                    {g.open}×
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[1.125rem] font-black">{g.title}</span>
                    <span className="block text-[0.875rem] text-ink-subtle">{g.tag}</span>
                  </span>
                </span>
                <span className="flex w-full items-center gap-2.5 text-ink">
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#f1ece2]">
                    <span className={cn("grow-x block h-full rounded-full", t.c)} style={{ width: `${mastery}%` }} />
                  </span>
                  <span className="text-[0.8125rem] font-extrabold text-ink-subtle">{mastery}% dikuasai</span>
                </span>
              </button>
            );
          })}
        </section>

        {cur ? (
          <section
            key={cur.key}
            aria-live="polite"
            aria-label="Detail pola"
            className="rise flex min-w-0 flex-1 flex-col gap-4 rounded-[26px] border-2 border-hairline bg-surface p-6 shadow-[0_5px_0_var(--color-hairline)]"
          >
            <div>
              <p className={cn("text-[0.8125rem] font-extrabold tracking-[0.08em]", tone.ink)}>{cur.tag}</p>
              <h2 className="mt-0.5 font-display text-[1.75rem] font-black">{cur.title}</h2>
              {cur.rule ? (
                <p className="mt-2.5 rounded-[6px_18px_18px_18px] bg-canvas px-4 py-3.5 text-[1.0625rem] font-semibold leading-normal">{cur.rule}</p>
              ) : null}
            </div>

            <div>
              <p className="mb-2.5 text-[0.8125rem] font-extrabold tracking-[0.08em] text-ink-subtle">
                {cur.kind === "vocab" ? "KATA YANG SERING LUPA" : cur.kind === "eptr" ? "SOAL MENUNGGU" : "JAWABANMU YANG SALAH"}
              </p>
              <ul className="flex flex-col gap-2.5">
                {cur.items.map((it, i) => (
                  <li key={i} className="rise flex flex-col gap-1.5 rounded-[16px] border-2 border-[#f1ece2] px-4 py-3.5" style={{ "--i": i + 1 } as React.CSSProperties}>
                    <p className="text-[1.125rem] leading-normal">{it.prompt}</p>
                    {it.yours ? (
                      <p className="text-[1rem]">
                        <span className="rounded-[6px] bg-brick-soft px-1.5 text-brick-deep line-through decoration-brick decoration-2">{it.yours}</span>
                        {it.key ? (
                          <>
                            {" "}
                            → <span className="rounded-[6px] bg-primary-soft px-1.5 font-bold text-primary-deep">{it.key}</span>
                          </>
                        ) : null}
                      </p>
                    ) : it.key ? (
                      <p className="text-[1rem] font-bold text-primary-deep">{it.key}</p>
                    ) : null}
                    {it.note ? <p className="text-[0.875rem] text-ink-subtle">{it.note}</p> : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-hairline pt-3.5">
              <p className="text-[0.9375rem] text-ink-subtle">Jawab benar soal ini lagi, dan kesalahan ini otomatis ditebus.</p>
              <Link
                href={cur.href}
                className="ledge flex min-h-[52px] items-center rounded-[14px] bg-primary px-5 font-display text-[1.0625rem] font-extrabold text-white"
              >
                {cur.hrefLabel}
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
