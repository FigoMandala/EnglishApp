"use client";

import { Clock, Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DrillHeader, DrillMain, DrillPage, FeedbackBar, PrimaryLink, SecondaryButton } from "@/components/drill/parts";
import { Confetti } from "@/components/fx/confetti";
import { Lori } from "@/components/mascot";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

import { finishDrillAction } from "../actions";

export type Pair = { id: number; word: string; meaning: string };

export function PairsDrill({ pairs, rightOrder }: { pairs: Pair[]; rightOrder: number[] }) {
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState<[number, number] | null>(null);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [sec, setSec] = useState(0);
  const [xp, setXp] = useState(0);
  const saved = useRef(false);

  const total = pairs.length;
  const allDone = total > 0 && matched.length === total;

  useEffect(() => {
    if (allDone || total === 0) return;
    const iv = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [allDone, total]);

  useEffect(() => {
    if (!wrong) return;
    const t = setTimeout(() => setWrong(null), 600);
    return () => clearTimeout(t);
  }, [wrong]);

  useEffect(() => {
    if (!allDone || saved.current) return;
    saved.current = true;
    sfx.levelUp();
    // Skor 0–10: pasangan + bonus combo − kesalahan (server membatasi XP).
    const score = Math.max(1, Math.min(10, total + Math.floor(best / 2) - mistakes));
    void finishDrillAction("pairs", score, 10).then((res) => {
      if (res.xp) setXp(res.xp);
    });
  }, [allDone, best, mistakes, total]);

  function evaluate(l: number | null, r: number | null) {
    if (l === null || r === null) return;
    setSelL(null);
    setSelR(null);
    if (l === r) {
      setMatched((m) => [...m, l]);
      setCombo((c) => {
        setBest((b) => Math.max(b, c + 1));
        return c + 1;
      });
      sfx.correct();
    } else {
      setWrong([l, r]);
      setCombo(0);
      setMistakes((n) => n + 1);
      sfx.wrong();
    }
  }

  function pick(side: "L" | "R", id: number) {
    if (matched.includes(id) || allDone) return;
    sfx.tap();
    if (side === "L") {
      setSelL(id);
      evaluate(id, selR);
    } else {
      setSelR(id);
      evaluate(selL, id);
    }
  }

  if (total < 2) {
    return (
      <DrillPage>
        <DrillHeader exitHref="/latihan" value={0} max={1} />
        <DrillMain className="flex flex-col items-center gap-4 pt-16 text-center">
          <Lori mood="think" size={160} />
          <h1 className="font-display text-[1.875rem] font-black">Belum cukup kata untuk dipasangkan</h1>
          <Link href="/latihan" className="font-extrabold text-primary hover:underline">
            Kembali ke Latihan
          </Link>
        </DrillMain>
      </DrillPage>
    );
  }

  const byId = new Map(pairs.map((p) => [p.id, p]));
  const clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  const tile = (id: number, side: "L" | "R", text: string) => {
    const done = matched.includes(id);
    const sel = (side === "L" ? selL : selR) === id;
    const isWrong = wrong !== null && wrong[side === "L" ? 0 : 1] === id;
    return (
      <button
        key={`${side}-${id}`}
        type="button"
        onClick={() => pick(side, id)}
        disabled={done}
        aria-pressed={sel}
        className={cn(
          "min-h-[68px] cursor-pointer rounded-[18px] border-2 px-5 text-[1.1875rem] font-bold shadow-[0_4px_0_var(--color-hairline)] transition-[transform,box-shadow,opacity] active:translate-y-1 active:shadow-none disabled:cursor-default",
          "border-hairline bg-surface text-ink",
          sel && "border-sky bg-[#eef3fd] shadow-[0_4px_0_var(--color-sky)]",
          isWrong && "shake border-brick bg-brick-soft text-brick-deep shadow-[0_4px_0_var(--color-brick)]",
          done && "border-[#9fd0b3] bg-[#eaf5ee] text-primary-deep opacity-55 shadow-none",
        )}
      >
        {text}
      </button>
    );
  };

  return (
    <DrillPage>
      <DrillHeader
        exitHref="/latihan"
        value={matched.length}
        max={total}
        barClass="bg-mango shadow-[inset_0_-5px_0_var(--color-mango-deep)]"
        trailing={
          <>
            <span className="inline-flex min-w-24 items-center gap-2 rounded-[12px] border-2 border-hairline bg-surface px-3 py-2 font-display font-black tabular-nums">
              <Clock className="size-4" aria-hidden />
              {clock}
            </span>
            <span
              aria-live="polite"
              className={cn(
                "inline-flex min-w-[120px] items-center gap-1.5 rounded-[12px] px-3 py-2 font-display font-black",
                combo >= 3 ? "bg-mango text-[#3a2400]" : "bg-[#f1ece2] text-ink-subtle",
              )}
            >
              <Flame className={cn("size-4", combo >= 3 && "flick")} aria-hidden />
              Combo ×{combo}
            </span>
          </>
        }
      />
      <DrillMain className="relative flex flex-wrap items-center gap-10">
        {allDone ? <Confetti count={36} /> : null}
        <section aria-label="Lori" className="flex w-full flex-col items-center gap-1.5 lg:max-w-[280px] lg:flex-1">
          <div className="pop rounded-[16px] border-2 border-hairline bg-surface px-4 py-3 text-center text-[1rem] font-bold shadow-[0_3px_0_var(--color-hairline)]">
            {allDone
              ? "Semua cocok! Cepat banget."
              : combo >= 3
                ? `Combo ×${combo}! Terus!`
                : wrong
                  ? "Belum cocok. Coba lagi."
                  : "Pilih satu kata, lalu artinya."}
          </div>
          <Lori mood={allDone ? "cheer" : wrong ? "sad" : combo >= 3 ? "cheer" : "idle"} size={200} label="Lori menemani" />
        </section>

        <section aria-label="Papan pasangan" className="flex min-w-0 flex-1 basis-[560px] flex-col gap-[18px]">
          <div className="rise">
            <h1 className="font-display text-[2.125rem] font-black tracking-[-0.02em]">Cocokkan kata dengan artinya</h1>
            <p className="mt-1.5 text-[1rem] text-ink-subtle">Pilih satu dari kiri, satu dari kanan. Tiga benar beruntun = combo.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
            <div className="flex flex-col gap-3">{pairs.map((p) => tile(p.id, "L", p.word))}</div>
            <div className="flex flex-col gap-3">{rightOrder.map((id) => tile(id, "R", byId.get(id)?.meaning ?? ""))}</div>
          </div>
        </section>
      </DrillMain>

      {allDone ? (
        <FeedbackBar tone="right" title="Semua cocok!">
          <span className="pop rounded-[12px] bg-surface px-3.5 py-2 font-extrabold text-primary-deep">Waktu {clock}</span>
          <span className="pop rounded-[12px] bg-surface px-3.5 py-2 font-extrabold text-primary-deep [--i:1]">Salah {mistakes}×</span>
          <span className="pop rounded-[12px] bg-mango px-3.5 py-2 font-black text-[#3a2400] [--i:2]">+{xp} XP</span>
          <SecondaryButton onClick={() => window.location.reload()}>MAIN LAGI</SecondaryButton>
          <PrimaryLink href="/latihan" className="min-w-[200px]">
            SELESAI
          </PrimaryLink>
        </FeedbackBar>
      ) : null}
    </DrillPage>
  );
}
