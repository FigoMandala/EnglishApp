"use client";

import { Clock, Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DrillHeader, DrillMain, DrillPage, PrimaryLink, SecondaryButton } from "@/components/drill/parts";
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
  const [wrongNonce, setWrongNonce] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [sec, setSec] = useState(0);
  const [xp, setXp] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
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
    // Skor 0–10: pasangan + bonus combo + bonus sempurna − kesalahan (server membatasi XP).
    const score = Math.max(1, Math.min(10, total + Math.floor(best / 2) - mistakes + (mistakes === 0 ? 1 : 0)));
    finishDrillAction("pairs", score, 10)
      .then((res) => {
        if (res.xp) setXp(res.xp);
      })
      .catch(() => {
        // Izinkan percobaan ulang kalau pengguna menekan "Main lagi".
        saved.current = false;
        setSaveFailed(true);
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
      setWrongNonce((n) => n + 1);
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
    const shakeCls = isWrong ? (wrongNonce % 2 === 1 ? "shake-b" : "shake") : null;
    return (
      <button
        key={`${side}-${id}`}
        type="button"
        onClick={() => pick(side, id)}
        disabled={done}
        aria-pressed={sel}
        className={cn(
          "min-h-16 w-full min-w-0 cursor-pointer break-words rounded-[18px] border-2 px-4 text-left transition-[transform,translate,box-shadow,opacity] active:translate-y-1 active:shadow-none disabled:cursor-default sm:px-5",
          side === "L" ? "font-display text-[1.25rem] font-extrabold" : "text-[1.0625rem] font-bold",
          "border-hairline bg-surface text-ink shadow-[0_4px_0_var(--color-hairline)]",
          sel && "border-sky bg-sky-soft text-sky-deep shadow-[0_4px_0_var(--color-sky-line)]",
          shakeCls && cn(shakeCls, "border-brick bg-brick-soft text-brick-deep shadow-[0_4px_0_var(--color-brick-line)]"),
          done && "border-primary-line bg-primary-soft text-primary-deep opacity-60 shadow-none",
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
        trailing={
          <span className="inline-flex shrink-0 items-center gap-1.5 font-round text-[1.25rem] font-extrabold tabular-nums text-ink-muted">
            <Clock className="size-[18px]" strokeWidth={2.4} aria-hidden />
            {clock}
          </span>
        }
      />
      <DrillMain className="relative flex max-w-[820px] flex-col gap-6">
        {allDone ? <Confetti count={36} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="rise">
            <h1 className="font-display text-[1.75rem] font-black tracking-[-0.02em]">Cocokkan kata dengan artinya</h1>
            <p className="mt-0.5 text-ink-subtle">Pilih satu dari kiri, satu dari kanan. Tiga benar beruntun = combo.</p>
          </div>
          <span
            aria-live="polite"
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full px-4 font-display text-[1.125rem] font-black",
              combo >= 3 ? "bg-charcoal text-mango-line" : "border-2 border-hairline bg-surface text-ink-muted",
            )}
          >
            <Flame className={cn("size-[18px]", combo >= 3 && "flick fill-mango text-mango")} aria-hidden />
            Combo ×{combo}
          </span>
        </div>

        <section aria-label="Papan pasangan" className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6">
          <div className="flex flex-col gap-3">{pairs.map((p) => tile(p.id, "L", p.word))}</div>
          <div className="flex flex-col gap-3">{rightOrder.map((id) => tile(id, "R", byId.get(id)?.meaning ?? ""))}</div>
        </section>

        <p role="status" className={cn("text-center text-[0.9375rem] font-extrabold", wrong ? "text-brick-deep" : "text-ink-muted")}>
          {allDone
            ? ""
            : wrong
              ? "Belum cocok. Coba lagi."
              : selL !== null
                ? "Sekarang pilih artinya di kanan."
                : selR !== null
                  ? "Sekarang pilih katanya di kiri."
                  : "Pilih satu kata, lalu artinya."}
        </p>
      </DrillMain>

      {allDone ? (
        <footer role="status" className="rise sticky bottom-0 border-t-2 border-primary-line bg-primary-soft">
          <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-4 px-6 py-5">
            <Lori mood="cheer" size={64} label="Lori bersorak" />
            <div className="min-w-0 flex-[1_1_240px] text-primary-deep">
              <p className="font-display text-[1.5rem] font-black">Semua cocok! Cepat banget.</p>
              <p className="text-[0.9375rem]">
                {clock} · salah {mistakes}× ·{" "}
                {xp ? `+${xp} XP` : saveFailed ? "XP gagal disimpan" : "XP dihitung…"}
              </p>
            </div>
            <SecondaryButton onClick={() => window.location.reload()} className="border-primary-line text-primary-deep">
              MAIN LAGI
            </SecondaryButton>
            <PrimaryLink href="/latihan">SELESAI</PrimaryLink>
          </div>
        </footer>
      ) : null}
    </DrillPage>
  );
}
