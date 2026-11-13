"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Lori } from "@/components/mascot";
import type { MistakeGroup } from "@/db/queries/drills";
import { cn } from "@/lib/utils";

const KIND_TONE = {
  grammar: "bg-brick-soft text-brick-deep",
  eptr: "bg-brick-soft text-brick-deep",
  vocab: "bg-mango-soft text-mango-ink",
} as const;

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

  const crumb = (
    <nav aria-label="Remah roti" className="flex items-center gap-2 text-[0.875rem] font-bold text-ink-subtle">
      <Link href="/latihan" className="text-ink-muted hover:text-primary-deep hover:underline">
        Latihan Bebas
      </Link>
      <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
      <span aria-current="page">Bank Kesalahan</span>
    </nav>
  );

  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {crumb}
        <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
          <Lori mood="cheer" size={180} label="Lori bersorak" />
          <h1 className="font-display text-[2.25rem] font-black tracking-[-0.03em]">Bank Kesalahan kosong</h1>
          <p className="max-w-md text-[1.0625rem] text-ink-subtle">
            Belum ada jawaban salah yang menunggu. Setiap kesalahan baru akan masuk ke sini, dikelompokkan per pola.
          </p>
          <Link
            href="/latihan"
            className="flex h-[54px] items-center rounded-[16px] bg-primary px-7 font-display text-[1.0625rem] font-extrabold text-white shadow-[0_5px_0_var(--color-primary-deep)]"
          >
            KEMBALI KE LATIHAN
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {crumb}
      <header className="rise flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[2rem] font-black leading-[1.1] tracking-[-0.02em] sm:text-[2.25rem]">Bank Kesalahan</h1>
          <p className="max-w-[560px] text-ink-subtle">
            Setiap jawaban salah disimpan di sini, dikelompokkan per pola. Jawab benar sekali lagi, dan kesalahannya
            otomatis ditebus · +5 XP per soal.
          </p>
        </div>
        <dl className="flex flex-wrap gap-3">
          <div className="rounded-[18px] border-2 border-brick-line bg-brick-soft px-[18px] py-3 text-brick-deep">
            <dt className="text-[0.75rem] font-extrabold">BELUM DITEBUS</dt>
            <dd className="font-round text-[1.875rem] font-extrabold leading-tight">{openTotal}</dd>
          </div>
          <div className="rounded-[18px] border-2 border-primary-line bg-primary-soft px-[18px] py-3 text-primary-deep">
            <dt className="text-[0.75rem] font-extrabold">JAWABAN BENAR</dt>
            <dd className="font-round text-[1.875rem] font-extrabold leading-tight">{correctTotal}</dd>
          </div>
        </dl>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav aria-label="Pola kesalahan" className="flex w-full flex-col gap-2.5 lg:w-[320px] lg:shrink-0">
          {groups.map((g, i) => {
            const active = i === sel;
            const mastery = g.total > 0 ? Math.round(((g.total - g.open) / g.total) * 100) : 0;
            return (
              <button
                key={g.key}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setSel(i)}
                className={cn(
                  "rise flex cursor-pointer flex-col gap-2.5 rounded-[18px] border-2 bg-surface p-4 text-left transition-transform active:translate-y-0.5",
                  active ? "border-brick shadow-[0_4px_0_var(--color-brick-line)]" : "border-hairline",
                )}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="flex w-full items-center gap-3">
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-[12px] font-round text-[1.25rem] font-extrabold", KIND_TONE[g.kind])}>
                    {g.open}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[0.9375rem]">{g.title}</strong>
                    <span className="block text-[0.8125rem] text-ink-subtle">{g.tag.toLowerCase()}</span>
                  </span>
                </span>
                <span className="flex w-full items-center gap-2.5">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-deep">
                    <span className="grow-x block h-full rounded-full bg-primary" style={{ width: `${mastery}%` }} />
                  </span>
                  <span className="text-[0.75rem] font-extrabold text-ink-subtle">{mastery}% dikuasai</span>
                </span>
              </button>
            );
          })}
        </nav>

        {cur ? (
          <section key={cur.key} aria-live="polite" aria-label="Detail pola" className="pop-in flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-[24px] border-2 border-hairline bg-surface p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="eyebrow text-brick-deep">
                    {cur.tag} · {cur.open} {cur.kind === "vocab" ? "kata" : "soal"} menunggu
                  </span>
                  <h2 className="font-display text-[1.625rem] font-black">{cur.title}</h2>
                </div>
                <Link
                  href={cur.href}
                  className="flex h-[52px] items-center rounded-[16px] bg-primary px-5 font-display text-[0.9375rem] font-extrabold tracking-[0.03em] text-white shadow-[0_5px_0_var(--color-primary-deep)] transition-transform active:translate-y-[5px] active:shadow-none"
                >
                  {cur.hrefLabel}
                </Link>
              </div>
              {cur.rule ? (
                <div className="flex items-start gap-3 rounded-[16px] border-2 border-hairline-soft bg-surface-muted p-4">
                  <Lori mood="talk" size={48} className="shrink-0" />
                  <p className="text-[0.9375rem] text-ink-muted">
                    <strong className="text-primary-deep">Aturannya:</strong> {cur.rule}
                  </p>
                </div>
              ) : null}
            </div>

            <h3 className="eyebrow mt-2 text-ink-subtle">
              {cur.kind === "vocab" ? "Kata yang sering lupa" : cur.kind === "eptr" ? "Soal menunggu" : "Jawabanmu yang salah"}
            </h3>
            <ul className="flex flex-col gap-3">
              {cur.items.map((it, i) => (
                <li
                  key={i}
                  className="flex flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-5"
                >
                  <p className="text-[1.125rem] font-semibold leading-normal">{it.prompt}</p>
                  {it.yours || it.key ? (
                    <div className="flex flex-wrap gap-2.5 text-[0.875rem] font-bold">
                      {it.yours ? (
                        <span className="rounded-[12px] bg-brick-soft px-3 py-1.5 text-brick-deep">
                          <span className="block text-[0.75rem] font-extrabold tracking-[0.06em]">JAWABANMU</span>
                          <s>{it.yours}</s>
                        </span>
                      ) : null}
                      {it.key ? (
                        <span className="rounded-[12px] bg-primary-soft px-3 py-1.5 text-primary-deep">
                          <span className="block text-[0.75rem] font-extrabold tracking-[0.06em]">YANG BENAR</span>
                          {it.key}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {it.note ? <p className="text-[0.875rem] text-ink-subtle">{it.note}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
