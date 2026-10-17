"use client";

import { Check, Eye, Flame, Loader2, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SpeakButton } from "@/components/speak-button";

import { logVocabSessionAction, reviewCardAction } from "../actions";

export type ReviewCard = {
  id: number;
  word: string;
  meaning: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  exampleEn: string | null;
  exampleId: string | null;
  mnemonic: string | null;
  box: number;
};

const BOX_LABEL = ["Baru", "Belajar", "Belajar", "Familiar", "Paham", "Kuat", "Kuat", "Kuat"];

export function ReviewSession({ cards }: { cards: ReviewCard[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [finished, setFinished] = useState(false);
  const [lastSchedule, setLastSchedule] = useState<string | null>(null);

  const card = cards[index] ?? null;
  const total = cards.length;

  // Shortcut keyboard: Spasi buka arti, 1 = belum hafal, 2 = sudah hafal.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (finished) return;
      if (event.key === " ") {
        // Tombol yang sedang fokus tetap merespons Spasi secara native.
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && event.key === "1") {
        void answer(false);
      } else if (revealed && event.key === "2") {
        void answer(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, finished, index, correct, total, busy]);

  async function answer(knew: boolean) {
    if (!card || busy) return;
    setBusy(true);
    try {
      const result = await reviewCardAction(card.id, knew);
      if (knew) setCorrect((prev) => prev + 1);
      else setWrong((prev) => prev + 1);
      if (result.dueAt) {
        const days = Math.round(
          (Date.parse(`${result.dueAt}T00:00:00Z`) - Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) /
            86_400_000,
        );
        setLastSchedule(days > 30 ? "1 bulan+" : days > 0 ? `${days} hari lagi` : "besok lagi");
      }
      if (index + 1 >= total) {
        await logVocabSessionAction(knew ? correct + 1 : correct, total);
        setFinished(true);
        router.refresh();
      } else {
        setIndex((prev) => prev + 1);
        setRevealed(false);
      }
    } finally {
      setBusy(false);
    }
  }

  if (total === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Check className="size-8" aria-hidden />
        </span>
        <h1 className="font-display text-[1.75rem] font-extrabold">Tidak ada kartu jatuh tempo</h1>
        <p className="max-w-md text-[0.9375rem] text-ink-subtle">
          Semua kartu sudah diulang sesuai jadwalnya. Kembali lagi besok, atau jelajahi daftar kata untuk
          mengenal kata baru.
        </p>
        <Link
          href="/kosakata"
          className="flex h-11 items-center gap-2 rounded-control bg-primary px-5 text-[0.9375rem] font-bold text-white shadow-card"
        >
          Kembali ke Kosakata
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Flame className="size-8" aria-hidden />
        </span>
        <h1 className="font-display text-[1.75rem] font-extrabold">Sesi selesai!</h1>
        <p className="text-[0.9375rem] text-ink-subtle">
          {correct} benar, {wrong} diulang dari {total} kartu. Kartu yang salah akan muncul lagi lebih cepat.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/kosakata"
            className="flex h-11 items-center gap-2 rounded-control bg-primary px-5 text-[0.9375rem] font-bold text-white shadow-card"
          >
            Kembali ke Kosakata
          </Link>
          <button
            type="button"
            onClick={() => router.push("/kosakata/review")}
            className="flex h-11 items-center gap-2 rounded-control border-2 border-hairline bg-surface px-5 text-[0.9375rem] font-bold text-ink"
          >
            <RotateCcw className="size-4" aria-hidden />
            Ulangi sesi lain
          </button>
        </div>
      </div>
    );
  }

  const progress = Math.round((index / total) * 100);
  const boxLabel = BOX_LABEL[card?.box ?? 0] ?? "Baru";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[0.875rem] font-semibold text-ink-subtle">
          <span>
            Kartu {index + 1} dari {total}
          </span>
          <span className="tnum">
            {correct} benar · {wrong} diulang
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-canvas-deep"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {card ? (
        <div className="clay flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-muted px-3 py-1 text-[0.75rem] font-bold text-ink-subtle">
              {boxLabel}
            </span>
            {card.partOfSpeech ? (
              <span className="font-mono text-[0.75rem] italic text-ink-faint">{card.partOfSpeech}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[2.25rem] font-extrabold leading-none text-ink">{card.word}</h1>
            <SpeakButton text={card.word} label={`Dengarkan ${card.word}`} />
          </div>
          {card.phonetic ? <p className="font-mono text-[0.875rem] text-ink-faint">{card.phonetic}</p> : null}

          {revealed ? (
            <div className="pop-in flex flex-col items-center gap-2">
              <p className="text-[1.25rem] font-bold text-primary-deep">{card.meaning}</p>
              {card.exampleEn ? (
                <p className="max-w-sm border-l-2 border-hairline pl-3 text-left text-[0.875rem] italic leading-snug text-ink-subtle">
                  {card.exampleEn}
                  {card.exampleId ? (
                    <span className="mt-0.5 block not-italic text-ink-faint">{card.exampleId}</span>
                  ) : null}
                </p>
              ) : null}
              {card.mnemonic ? (
                <p className="max-w-sm rounded-control bg-mango-soft px-3 py-2 text-[0.875rem] text-mango-ink">
                  <strong>Jembatan keledai:</strong> {card.mnemonic}
                </p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="flex h-12 items-center gap-2 rounded-control border-2 border-dashed border-hairline-strong px-6 text-[0.9375rem] font-bold text-ink-subtle transition-colors hover:border-primary hover:text-primary"
            >
              <Eye className="size-4" aria-hidden />
              Lihat arti
              <kbd className="ml-1 hidden rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold sm:inline">Spasi</kbd>
            </button>
          )}
        </div>
      ) : null}

      {revealed ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => answer(false)}
            className="flex min-h-14 items-center justify-center gap-2 rounded-control border-2 border-negative/40 bg-negative-soft text-[0.9375rem] font-bold text-negative transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
            Belum hafal
            <kbd className="ml-1 hidden rounded bg-white/60 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold sm:inline">1</kbd>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => answer(true)}
            className="flex min-h-14 items-center justify-center gap-2 rounded-control bg-primary text-[0.9375rem] font-bold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Sudah hafal
            <kbd className="ml-1 hidden rounded bg-white/25 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold sm:inline">2</kbd>
          </button>
        </div>
      ) : null}

      {lastSchedule && !finished ? (
        <p className="text-center text-[0.8125rem] text-ink-faint">
          Kartu sebelumnya dijadwalkan {lastSchedule}.
        </p>
      ) : null}
    </div>
  );
}
