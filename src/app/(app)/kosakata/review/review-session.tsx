"use client";

import { Lightbulb, Loader2, RotateCcw, Volume2, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Confetti } from "@/components/fx/confetti";
import { Lori } from "@/components/mascot";
import { sfx } from "@/lib/sfx";
import { DEFAULT_PREFS, speakLines } from "@/lib/voices";
import { cn } from "@/lib/utils";

import { logVocabSessionAction, reviewCardAction } from "../actions";
import { todayISO } from "@/lib/srs";

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

type Grade = { label: string; hint: string; knew: boolean; grade?: "hard" | "good" | "easy"; cls: string; sub: string };
const GRADES: Grade[] = [
  { label: "Lupa", hint: "ulang sebentar lagi", knew: false, cls: "border-2 border-brick-line bg-brick-soft text-brick-deep shadow-[0_4px_0_var(--color-brick-line)]", sub: "" },
  { label: "Sulit", hint: "segera lagi", knew: true, grade: "hard", cls: "border-2 border-mango-line bg-mango-soft text-mango-ink shadow-[0_4px_0_var(--color-mango-line)]", sub: "" },
  { label: "Familiar", hint: "beberapa hari", knew: true, grade: "good", cls: "border-2 border-sky-line bg-sky-soft text-sky-deep shadow-[0_4px_0_var(--color-sky-line)]", sub: "" },
  { label: "Gampang", hint: "paling lama", knew: true, grade: "easy", cls: "bg-primary text-white shadow-[0_4px_0_var(--color-primary-deep)]", sub: "text-primary-soft" },
];

const PRESS = "transition-[transform,box-shadow] duration-150 active:translate-y-1 active:shadow-none";
const BIG_BTN = `${PRESS} flex h-[54px] cursor-pointer items-center justify-center gap-2 rounded-[16px] px-8 font-display text-[1.0625rem] font-extrabold tracking-[0.03em]`;

/** Bold kata target di kalimat contoh. */
function mark(sentence: string, word: string) {
  const at = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return sentence;
  return (
    <>
      {sentence.slice(0, at)}
      <mark className="bg-[linear-gradient(transparent_55%,var(--color-mango-mark)_55%)] font-bold text-inherit">
        {sentence.slice(at, at + word.length)}
      </mark>
      {sentence.slice(at + word.length)}
    </>
  );
}

export function ReviewSession({ cards, forecast }: { cards: ReviewCard[]; forecast: ForecastDay[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSchedule, setLastSchedule] = useState<string | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const card = cards[index] ?? null;
  const total = cards.length;

  // Pintasan keyboard: Spasi balik kartu, 1-4 memberi nilai, P putar audio.
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
      } else if ((event.key === "p" || event.key === "P") && card) {
        speakLines([{ speaker: "woman", text: card.word }], DEFAULT_PREFS);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, finished, index, correct, total, busy]);

  useEffect(() => () => { if (swapTimer.current) clearTimeout(swapTimer.current); }, []);

  async function answer(g: Grade) {
    if (!card || busy) return;
    setBusy(true);
    try {
      const result = await reviewCardAction(card.id, g.knew, g.grade);
      if (result.status === "error") {
        setError(result.message ?? "Jawaban tidak tersimpan. Coba lagi.");
        return; // kartu tidak maju, nilai bisa diberikan ulang
      }
      setError(null);
      if (g.knew) {
        setCorrect((prev) => prev + 1);
        sfx.correct();
      } else {
        setWrong((prev) => prev + 1);
        sfx.wrong();
      }
      if (result.dueAt) {
        const days = Math.round(
          (Date.parse(`${result.dueAt}T00:00:00Z`) - Date.parse(todayISO() + "T00:00:00Z")) /
            86_400_000,
        );
        setLastSchedule(days > 30 ? "1 bulan+" : days > 1 ? `${days} hari lagi` : "besok lagi");
      }
      if (index + 1 >= total) {
        // Nilai kartu terakhir sudah tersimpan; log sesi hanya pelengkap,
        // jadi kegagalannya tidak boleh membuat pengguna terjebak di kartu ini.
        await logVocabSessionAction(g.knew ? correct + 1 : correct, total).catch(() => undefined);
        setFinished(true);
        sfx.levelUp();
        router.refresh();
      } else {
        // Tukar isi kartu setelah flip-back hampir selesai (400 ms), jadi kata baru
        // tidak terlihat "teleport" di tengah kartu yang masih terbalik.
        setRevealed(false);
        if (swapTimer.current) clearTimeout(swapTimer.current);
        swapTimer.current = setTimeout(() => {
          swapTimer.current = null;
          setIndex((prev) => prev + 1);
        }, 240);
      }
    } catch {
      setError("Koneksi bermasalah. Jawaban belum tersimpan, coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <header className="border-b-2 border-hairline">
      <div className="mx-auto flex w-full max-w-[1040px] items-center gap-[18px] px-6 py-4">
        <Link
          href="/kosakata"
          aria-label="Keluar dari sesi ulang"
          className="grid size-11 shrink-0 place-items-center rounded-[12px] text-ink-subtle hover:bg-surface"
        >
          <X className="size-6" strokeWidth={2.6} aria-hidden />
        </Link>
        <div
          role="progressbar"
          aria-label="Kartu diulang"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, total)}
          aria-valuenow={finished ? total : index}
          className="h-3.5 flex-1 overflow-hidden rounded-full bg-canvas-deep"
        >
          <div
            className="h-full w-full origin-left rounded-full bg-mango shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${total ? (finished ? total : index) / total : 0})` }}
          />
        </div>
        <span className="text-[0.875rem] font-extrabold tabular-nums text-ink-muted">
          {finished ? total : index} / {total}
        </span>
        <span className="flex items-center gap-1 font-round text-[1.25rem] font-extrabold text-mango-deep">
          <Zap className="size-[18px] fill-mango text-mango" aria-hidden />
          {correct * 3}
        </span>
      </div>
    </header>
  );

  if (total === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        {header}
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Lori mood="cheer" size={180} label="Lori bersorak" />
          <h1 className="font-display text-[1.875rem] font-black">Tidak ada kartu jatuh tempo</h1>
          <p className="max-w-md text-ink-subtle">
            Semua kartu sudah diulang sesuai jadwalnya. Kembali besok, atau jelajahi daftar kata untuk kenalan dengan kata baru.
          </p>
          <Link href="/kosakata" className={cn(BIG_BTN, "bg-primary text-white shadow-[0_5px_0_var(--color-primary-deep)]")}>
            KEMBALI KE KOSAKATA
          </Link>
        </main>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        {header}
        <main className="relative flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden px-6 py-12 text-center">
          <Confetti count={36} />
          <div aria-hidden className="absolute left-1/2 top-6 size-[460px] -translate-x-1/2 rounded-full bg-canvas-deep" />
          <Lori mood="cheer" size={200} label="Lori melompat gembira" className="relative" />
          <h1 className="pop relative font-display text-[2.75rem] font-black leading-none tracking-[-0.03em]">Sesi selesai!</h1>
          <p className="relative text-[1.125rem] text-ink-muted">
            {correct} diingat, {wrong} diulang dari {total} kartu. Yang lupa muncul lagi lebih cepat.
          </p>
          <ul className="relative grid w-full max-w-[560px] grid-cols-3 gap-3">
            {[
              { l: "TOTAL XP", v: correct * 3, head: "bg-mango text-mango-on", box: "border-mango-line bg-mango-soft text-mango-ink" },
              { l: "INGAT", v: correct, head: "bg-primary text-white", box: "border-primary-line bg-primary-soft text-primary-deep" },
              { l: "LUPA", v: wrong, head: "bg-brick text-white", box: "border-brick-line bg-brick-soft text-brick-deep" },
            ].map((s) => (
              <li key={s.l} className={cn("overflow-hidden rounded-plate border-2", s.box)}>
                <p className={cn("py-1.5 text-[0.75rem] font-extrabold tracking-[0.08em]", s.head)}>{s.l}</p>
                <p className="py-4 font-round text-[2rem] font-extrabold leading-none">{s.v}</p>
              </li>
            ))}
          </ul>
        </main>
        <footer className="sticky bottom-0 border-t-2 border-hairline bg-canvas">
          <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-4 px-6 py-5">
            <button
              type="button"
              // Navigasi penuh (bukan router.push): komponen yang sama akan
              // direkonsiliasi React dengan state lama (finished=true) sehingga
              // layar "Sesi selesai" tidak pernah ter-reset.
              onClick={() => window.location.assign("/kosakata/review")}
              className={cn(BIG_BTN, "border-2 border-hairline bg-surface text-ink shadow-[0_4px_0_var(--color-hairline)]")}
            >
              <RotateCcw className="size-4" aria-hidden />
              SESI LAIN
            </button>
            <Link href="/kosakata" className={cn(BIG_BTN, "bg-primary text-white shadow-[0_5px_0_var(--color-primary-deep)]")}>
              KEMBALI KE KOSAKATA
            </Link>
          </div>
        </footer>
      </div>
    );
  }

  const boxLabel = BOX_LABEL[card?.box ?? 0] ?? "Baru";
  const maxForecast = Math.max(1, ...forecast.map((d) => d.count));

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {header}
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-start justify-center gap-8">
          <section className="flex min-w-0 max-w-[640px] flex-[1_1_560px] flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border-2 px-2.5 py-0.5 text-[0.75rem] font-extrabold",
                  card?.box === 0 ? "border-mango bg-mango text-mango-on" : "border-mango-line bg-mango-soft text-mango-ink",
                )}
              >
                {card?.box === 0 ? "BARU" : "Jatuh tempo"}
              </span>
              <span className="text-[0.8125rem] font-bold text-ink-subtle">
                Tingkat ingatan: {boxLabel}
                {card?.partOfSpeech ? ` · ${card.partOfSpeech}` : ""}
              </span>
            </div>

            <div className="[perspective:1600px]">
              <button
                type="button"
                onClick={() => setRevealed((value) => !value)}
                aria-label={revealed ? "Balik ke kata" : "Balik kartu, lihat arti"}
                className="relative block h-[400px] w-full cursor-pointer border-0 bg-transparent p-0 text-left"
              >
                <span
                  className="absolute inset-0 block transition-transform duration-400 ease-[cubic-bezier(.3,1.3,.5,1)] [transform-style:preserve-3d] motion-reduce:transition-none"
                  style={{ transform: `rotateY(${revealed ? 180 : 0}deg)` }}
                >
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[32px] border-2 border-hairline bg-surface px-6 shadow-[0_8px_0_var(--color-hairline)] [backface-visibility:hidden]">
                    <span className="eyebrow absolute left-6 top-5 text-ink-subtle">Inggris → Indonesia</span>
                    <span className="break-words text-center font-display text-[3rem] font-black leading-none tracking-[-0.02em] sm:text-[4rem]">
                      {card?.word}
                    </span>
                    {card?.phonetic || card?.partOfSpeech ? (
                      <span className="text-[1.125rem] text-ink-subtle">
                        {[card.phonetic, card.partOfSpeech].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    <span className="mt-6 flex items-center gap-2 text-[0.875rem] font-bold text-ink-subtle">
                      <RotateCcw className="size-4" aria-hidden />
                      Klik kartu atau tekan Spasi untuk lihat arti
                    </span>
                  </span>
                  <span className="absolute inset-0 flex flex-col gap-4 overflow-y-auto rounded-[32px] border-2 border-hairline bg-surface px-8 py-8 shadow-[0_8px_0_var(--color-hairline)] [backface-visibility:hidden] [transform:rotateY(180deg)] sm:px-10">
                    <span className="flex flex-wrap items-baseline gap-3">
                      <span className="font-display text-[2.25rem] font-black leading-none">{card?.word}</span>
                      {card?.phonetic ? <span className="text-[0.9375rem] text-ink-subtle">{card.phonetic}</span> : null}
                    </span>
                    <span className="font-display text-[1.75rem] font-extrabold leading-tight text-primary-deep">{card?.meaning}</span>
                    {card?.exampleEn ? (
                      <span className="rounded-[18px] border-2 border-hairline-soft bg-surface-muted p-4 text-[1.125rem] leading-normal">
                        {mark(card.exampleEn, card.word)}
                        {card.exampleId ? <span className="mt-1 block text-[0.875rem] text-ink-subtle">{card.exampleId}</span> : null}
                      </span>
                    ) : null}
                    {card?.mnemonic ? (
                      <span className="flex gap-3 rounded-[18px] bg-sky-soft p-4 text-[0.9375rem] text-sky-deep">
                        <Lightbulb className="mt-0.5 size-5 shrink-0" strokeWidth={2.4} aria-hidden />
                        <span>
                          <strong>Jembatan keledai:</strong> {card.mnemonic}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </div>

            {card ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  aria-label={`Dengarkan ${card.word}`}
                  onClick={() => speakLines([{ speaker: "woman", text: card.word }], DEFAULT_PREFS)}
                  className={`${PRESS} flex h-[52px] cursor-pointer items-center gap-2.5 rounded-[16px] bg-sky px-5 font-display text-[0.9375rem] font-extrabold text-white shadow-[0_5px_0_var(--color-sky-deep)]`}
                >
                  <Volume2 className="size-5" aria-hidden />
                  Dengarkan
                </button>
              </div>
            ) : null}
            {lastSchedule ? (
              <p className="text-center text-[0.8125rem] text-ink-subtle">Kartu sebelumnya dijadwalkan {lastSchedule}.</p>
            ) : null}
          </section>

          <aside aria-label="Statistik dek" className="flex w-full flex-col gap-3.5 sm:w-[280px] sm:shrink-0">
            <div className="flex flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-5">
              <span className="eyebrow text-ink-subtle">Sesi ini</span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <span>
                  <span className="block font-round text-[1.625rem] font-extrabold leading-tight text-primary">{correct}</span>
                  <span className="text-[0.75rem] font-bold text-ink-subtle">ingat</span>
                </span>
                <span>
                  <span className="block font-round text-[1.625rem] font-extrabold leading-tight text-brick">{wrong}</span>
                  <span className="text-[0.75rem] font-bold text-ink-subtle">lupa</span>
                </span>
                <span>
                  <span className="block font-round text-[1.625rem] font-extrabold leading-tight">{total - index}</span>
                  <span className="text-[0.75rem] font-bold text-ink-subtle">sisa</span>
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-plate border-2 border-hairline bg-surface p-5">
              <span className="eyebrow text-ink-subtle">Jadwal ulang 7 hari</span>
              <div
                role="img"
                aria-label={`Jumlah kartu jatuh tempo per hari: ${forecast.map((d) => d.count).join(", ")}`}
                className="flex h-[84px] items-end gap-1.5"
              >
                {forecast.map((d, k) => (
                  <span key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span
                      className={cn("grow-y w-full rounded-[5px_5px_2px_2px]", k === 0 ? "bg-mango" : "bg-canvas-deep")}
                      style={{ height: `${Math.max(4, Math.round((d.count / maxForecast) * 64))}px`, "--i": k } as React.CSSProperties}
                    />
                    <span className="text-[0.6875rem] font-bold text-ink-subtle">
                      {k === 0 ? "Ini" : DAY[new Date(`${d.date}T00:00:00Z`).getUTCDay()]}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden flex-col gap-2.5 rounded-plate border-2 border-hairline bg-surface p-5 sm:flex">
              <span className="eyebrow text-ink-subtle">Pintasan</span>
              {[
                ["Balik kartu", "Spasi"],
                ["Nilai ingatan", "1 – 4"],
                ["Putar audio", "P"],
              ].map(([label, key]) => (
                <span key={label} className="flex justify-between text-[0.875rem]">
                  <span>{label}</span>
                  <kbd className="rounded-[6px] border-2 border-hairline px-2 font-sans text-[0.75rem] font-extrabold">{key}</kbd>
                </span>
              ))}
            </div>
          </aside>
        </div>
      </main>

      <footer className="sticky bottom-0 border-t-2 border-hairline bg-canvas">
        <div className="mx-auto max-w-[1040px] px-6 py-5">
          {error ? (
            <p role="alert" className="mb-3 rounded-[12px] bg-brick-soft px-4 py-2.5 text-center text-[0.875rem] font-bold text-brick-deep">
              {error}
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
                    PRESS,
                    "pop-in flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-[16px] font-display text-[1rem] font-extrabold disabled:opacity-60",
                    g.cls,
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {g.label}
                  </span>
                  <span className={cn("font-sans text-[0.75rem] font-bold", g.sub)}>
                    {i + 1} · {g.hint}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className={cn(BIG_BTN, "min-w-[240px] bg-primary px-12 text-white shadow-[0_5px_0_var(--color-primary-deep)]")}
              >
                LIHAT ARTI
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
