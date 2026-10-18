"use client";

import { Check, Flame, Loader2, RotateCcw, Volume2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Confetti } from "@/components/fx/confetti";
import { Lori } from "@/components/mascot";
import { sfx } from "@/lib/sfx";
import { DEFAULT_PREFS, speakLines } from "@/lib/voices";
import { cn } from "@/lib/utils";

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

export type ForecastDay = { date: string; count: number };

const BOX_LABEL = ["Baru", "Belajar", "Belajar", "Familiar", "Paham", "Kuat", "Kuat", "Kuat"];
const DAY = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

type Grade = { label: string; hint: string; knew: boolean; grade?: "hard" | "good" | "easy"; cls: string };
const GRADES: Grade[] = [
  { label: "Lupa", hint: "besok lagi", knew: false, cls: "bg-brick text-white [--ledge:var(--color-brick-deep)]" },
  { label: "Susah", hint: "segera lagi", knew: true, grade: "hard", cls: "bg-mango text-[#3a2400] [--ledge:var(--color-mango-deep)]" },
  { label: "Bisa", hint: "beberapa hari", knew: true, grade: "good", cls: "bg-primary text-white [--ledge:var(--color-primary-deep)]" },
  { label: "Gampang", hint: "paling lama", knew: true, grade: "easy", cls: "bg-sky text-white [--ledge:var(--color-sky-deep)]" },
];

const ledgeBtn =
  "ledge flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[16px] px-7 font-display text-[1.1875rem] font-extrabold tracking-[0.02em]";

export function ReviewSession({ cards, forecast }: { cards: ReviewCard[]; forecast: ForecastDay[] }) {
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

  // Pintasan keyboard: Spasi balik kartu, 1-4 memberi nilai.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      if (finished) return;
      if (event.key === " ") {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        setRevealed((value) => !value);
      } else if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        void answer(GRADES[Number(event.key) - 1]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, finished, index, correct, total, busy]);

  async function answer(g: Grade) {
    if (!card || busy) return;
    setBusy(true);
    try {
      const result = await reviewCardAction(card.id, g.knew, g.grade);
      if (g.knew) {
        setCorrect((prev) => prev + 1);
        sfx.correct();
      } else {
        setWrong((prev) => prev + 1);
        sfx.wrong();
      }
      if (result.dueAt) {
        const days = Math.round(
          (Date.parse(`${result.dueAt}T00:00:00Z`) - Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) /
            86_400_000,
        );
        setLastSchedule(days > 30 ? "1 bulan+" : days > 1 ? `${days} hari lagi` : "besok lagi");
      }
      if (index + 1 >= total) {
        await logVocabSessionAction(g.knew ? correct + 1 : correct, total);
        setFinished(true);
        sfx.levelUp();
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Lori mood="cheer" size={180} label="Lori bersorak" />
        <h1 className="font-display text-[1.875rem] font-black">Tidak ada kartu jatuh tempo</h1>
        <p className="max-w-md text-[1rem] text-ink-subtle">
          Semua kartu sudah diulang sesuai jadwalnya. Kembali besok, atau jelajahi daftar kata untuk kenalan dengan kata baru.
        </p>
        <Link href="/kosakata" className={cn(ledgeBtn, "bg-primary text-white")}>
          KEMBALI KE KOSAKATA
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="relative flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Confetti count={36} />
        <Lori mood="cheer" size={200} label="Lori melompat gembira" />
        <h1 className="pop font-display text-[2.5rem] font-black tracking-[-0.03em] text-primary">Sesi selesai!</h1>
        <p className="text-[1.125rem] text-ink-subtle">
          {correct} diingat, {wrong} diulang dari {total} kartu. Yang lupa muncul lagi lebih cepat.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/kosakata" className={cn(ledgeBtn, "bg-primary text-white")}>
            KEMBALI KE KOSAKATA
          </Link>
          <button
            type="button"
            onClick={() => router.push("/kosakata/review")}
            className={cn(
              ledgeBtn,
              "border-2 border-hairline bg-surface text-ink [--ledge:var(--color-hairline)]",
            )}
          >
            <RotateCcw className="size-4" aria-hidden />
            SESI LAIN
          </button>
        </div>
      </div>
    );
  }

  const boxLabel = BOX_LABEL[card?.box ?? 0] ?? "Baru";
  const counts = {
    baru: cards.filter((c) => c.box === 0).length,
    belajar: cards.filter((c) => c.box >= 1 && c.box <= 2).length,
    ulang: cards.filter((c) => c.box >= 3).length,
  };
  const maxForecast = Math.max(1, ...forecast.map((d) => d.count));

  return (
    <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="rise">
          <p className="text-[0.875rem] font-extrabold tracking-[0.08em] text-[#17603c]">ULANG HARI INI</p>
          <div className="mt-2.5 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Kartu diulang"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={index}
              className="h-3.5 flex-1 overflow-hidden rounded-full bg-hairline"
            >
              <div
                className="h-full rounded-full bg-mango shadow-[inset_0_-4px_0_var(--color-mango-deep)] transition-[width] duration-500"
                style={{ width: `${(index / total) * 100}%` }}
              />
            </div>
            <span className="text-[0.9375rem] font-extrabold tabular-nums text-ink-subtle">
              {index} / {total}
            </span>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 [perspective:1600px]">
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? "Balik ke kata" : "Balik kartu, lihat arti"}
              className="relative block h-[420px] w-full cursor-pointer border-0 bg-transparent p-0 text-left"
            >
              <span aria-hidden className="absolute inset-[14px_-10px_-10px_14px] rounded-[30px] bg-canvas-deep" />
              <span aria-hidden className="absolute inset-[7px_-5px_-5px_7px] rounded-[30px] bg-[#efe7d8]" />
              <span
                className="absolute inset-0 block transition-transform duration-700 ease-[cubic-bezier(.3,1.3,.5,1)] [transform-style:preserve-3d] motion-reduce:transition-none"
                style={{ transform: `rotateY(${revealed ? 180 : 0}deg)` }}
              >
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 rounded-[30px] border-2 border-hairline bg-surface px-6 shadow-[0_6px_0_var(--color-hairline)] [backface-visibility:hidden]">
                  <span className="flex items-center gap-2">
                    <span className="rounded-[10px] bg-surface-muted px-3 py-1.5 text-[0.8125rem] font-extrabold tracking-[0.06em] text-ink-subtle">
                      {boxLabel.toUpperCase()}
                    </span>
                    {card?.partOfSpeech ? (
                      <span className="rounded-[10px] bg-[#f1e8f7] px-3 py-1.5 text-[0.8125rem] font-extrabold uppercase tracking-[0.06em] text-[#5d2e86]">
                        {card.partOfSpeech}
                      </span>
                    ) : null}
                  </span>
                  <span className="break-words text-center font-display text-[3rem] font-black tracking-[-0.03em] sm:text-[4.25rem]">
                    {card?.word}
                  </span>
                  {card?.phonetic ? <span className="text-[1.25rem] text-ink-subtle">{card.phonetic}</span> : null}
                  <span className="mt-4 text-[0.9375rem] font-extrabold text-ink-faint">Klik kartu untuk lihat arti</span>
                </span>
                <span className="absolute inset-0 flex flex-col gap-3.5 overflow-y-auto rounded-[30px] border-2 border-[#9fd0b3] bg-surface px-9 py-8 shadow-[0_6px_0_#9fd0b3] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <span className="flex flex-wrap items-baseline gap-3">
                    <span className="font-display text-[2.5rem] font-black">{card?.word}</span>
                    {card?.phonetic ? <span className="text-[1.0625rem] text-ink-subtle">{card.phonetic}</span> : null}
                  </span>
                  <span className="font-display text-[1.875rem] font-extrabold text-primary-deep">{card?.meaning}</span>
                  {card?.exampleEn ? (
                    <span className="rounded-[14px] bg-canvas px-4 py-3.5 text-[1.1875rem] leading-normal">
                      {card.exampleEn}
                      {card.exampleId ? (
                        <span className="mt-1 block text-[1rem] text-ink-subtle">{card.exampleId}</span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          </div>

          <div className="mb-[-6px] hidden w-[210px] shrink-0 flex-col items-center gap-1 xl:flex">
            {card?.mnemonic ? (
              <div className="pop rounded-[16px_16px_16px_4px] border-2 border-hairline bg-surface px-3.5 py-3 text-[0.9375rem] font-semibold leading-snug shadow-[0_3px_0_var(--color-hairline)]">
                <strong className="block text-mango-ink">Jembatan keledai</strong>
                {card.mnemonic}
              </div>
            ) : null}
            <Lori mood={revealed ? "cheer" : "think"} size={120} />
          </div>
        </div>

        {card?.mnemonic ? (
          <p className="rounded-[14px] bg-mango-soft px-4 py-3 text-[0.9375rem] text-mango-ink xl:hidden">
            <strong>Jembatan keledai:</strong> {card.mnemonic}
          </p>
        ) : null}

        {revealed ? (
          <div role="group" aria-label="Seberapa ingat?" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {GRADES.map((g, i) => (
              <button
                key={g.label}
                type="button"
                disabled={busy}
                onClick={() => answer(g)}
                className={cn(
                  "ledge pop flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[16px] p-2.5 disabled:opacity-60",
                  g.cls,
                )}
                style={{ "--i": i } as React.CSSProperties}
              >
                <span className="flex items-center gap-1.5 font-display text-[1.1875rem] font-black">
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {g.label}
                </span>
                <span className="text-[0.875rem] font-bold opacity-90">{g.hint}</span>
                <kbd className="sr-only">tombol {i + 1}</kbd>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {card ? (
              <button
                type="button"
                aria-label={`Putar pelafalan ${card.word}`}
                onClick={() => speakLines([{ speaker: "woman", text: card.word }], DEFAULT_PREFS)}
                className="ledge flex min-h-14 cursor-pointer items-center gap-2.5 rounded-[16px] bg-sky px-[22px] font-display text-[1.0625rem] font-extrabold text-white [--ledge:var(--color-sky-deep)]"
              >
                <Volume2 className="size-5" aria-hidden />
                DENGARKAN
              </button>
            ) : null}
            <button type="button" onClick={() => setRevealed(true)} className={cn(ledgeBtn, "min-w-[260px] bg-primary text-white")}>
              TAMPILKAN ARTI
            </button>
          </div>
        )}

        {lastSchedule ? (
          <p className="text-center text-[0.8125rem] text-ink-faint">Kartu sebelumnya dijadwalkan {lastSchedule}.</p>
        ) : null}
      </section>

      <aside aria-label="Statistik dek" className="flex w-full flex-col gap-3.5 lg:w-80 lg:shrink-0">
        <div className="rise grid grid-cols-3 gap-2.5">
          {[
            { n: counts.baru, l: "baru", cls: "bg-sky-soft text-sky-deep" },
            { n: counts.belajar, l: "belajar", cls: "bg-mango-soft text-mango-ink" },
            { n: counts.ulang, l: "ulang", cls: "bg-primary-soft text-primary-deep" },
          ].map((t) => (
            <div key={t.l} className={cn("rounded-[16px] px-2.5 py-3.5 text-center", t.cls)}>
              <p className="font-display text-[1.625rem] font-black">{t.n}</p>
              <p className="text-[0.8125rem] font-extrabold">{t.l}</p>
            </div>
          ))}
        </div>

        <div className="rise rounded-[22px] border-2 border-hairline bg-surface p-[18px] shadow-[0_4px_0_var(--color-hairline)] [--i:2]">
          <h2 className="font-display text-[1.125rem] font-black">Jadwal ulang 7 hari</h2>
          <div
            role="img"
            aria-label={`Jumlah kartu jatuh tempo per hari: ${forecast.map((d) => d.count).join(", ")}`}
            className="mt-3.5 flex h-[120px] items-end gap-2"
          >
            {forecast.map((d, k) => (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[0.75rem] font-extrabold text-ink-subtle">{d.count || ""}</span>
                <span
                  className={cn("grow-y w-full rounded-[6px_6px_2px_2px]", k === 0 ? "bg-mango" : "bg-hairline-strong")}
                  style={{ height: `${Math.max(4, Math.round((d.count / maxForecast) * 80))}px`, "--i": k } as React.CSSProperties}
                />
                <span className="text-[0.75rem] font-bold text-ink-faint">
                  {k === 0 ? "Ini" : DAY[new Date(`${d.date}T00:00:00Z`).getUTCDay()]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rise rounded-[22px] border-2 border-hairline bg-surface p-[18px] [--i:3]">
          <h2 className="mb-2.5 font-display text-[1.125rem] font-black">Mode latihan lain</h2>
          <ul className="flex flex-col gap-1.5 text-[0.9375rem] font-bold">
            <li>
              <Link href="/latihan" className="flex min-h-11 items-center gap-2 rounded-[12px] px-2.5 hover:bg-surface-muted">
                <Flame className="size-4 text-primary" aria-hidden /> Latihan Bebas
              </Link>
            </li>
            <li>
              <Link href="/tutor" className="flex min-h-11 items-center gap-2 rounded-[12px] px-2.5 hover:bg-surface-muted">
                <Volume2 className="size-4 text-sky" aria-hidden /> Ngobrol dengan Tutor AI
              </Link>
            </li>
          </ul>
        </div>
        <p className="sr-only">
          <Check aria-hidden /> {correct} benar, {wrong} diulang
        </p>
      </aside>
    </div>
  );
}
