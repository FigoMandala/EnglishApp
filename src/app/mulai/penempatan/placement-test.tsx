"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { checkPlacementAnswerAction } from "./actions";
import { DrillFooter, DrillHeader, DrillMain, DrillPage, FeedbackBar, PrimaryButton, SecondaryButton } from "@/components/drill/parts";
import { Lori } from "@/components/mascot";
import type { PlacementQuestion } from "@/db/queries/onboarding";
import type { WordLevel } from "@/lib/cefr";
import { normalizeAnswer } from "@/lib/grammar-exercise";
import { saveOnboarding } from "@/lib/onboarding";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const LEVEL_LABEL: Record<WordLevel, string> = { basic: "DASAR", intermediate: "MENENGAH", advanced: "LANJUT" };

export function PlacementTest({ questions }: { questions: PlacementQuestion[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [picks, setPicks] = useState<(string | null)[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; keys: string[] } | null>(null);
  const [checking, setChecking] = useState(false);

  const q = questions[index];
  const right = Boolean(feedback?.ok);

  // Penilaian di server (kunci tidak ikut payload halaman); kunci balikan
  // dipakai untuk sorotan jawaban benar setelah pengguna memeriksa.
  const isCorrectOption = (option: string) =>
    feedback?.keys.some((key) => normalizeAnswer(key) === normalizeAnswer(option)) ?? false;

  async function check(skip = false) {
    if (checked || checking) return;
    setChecking(true);
    const choice = skip ? null : picked;
    let ok = false;
    let keys: string[] = [];
    try {
      const res = await checkPlacementAnswerAction(q.id, choice);
      ok = res.ok;
      keys = res.keys;
    } catch {
      // Koneksi gagal: anggap belum tepat, biar aliran tes tetap jalan.
      ok = false;
    }
    setSkipped(skip);
    setChecked(true);
    setFeedback({ ok, keys });
    setResults((prev) => [...prev, ok]);
    setPicks((prev) => [...prev, choice]);
    (ok ? sfx.correct : sfx.wrong)();
    setChecking(false);
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPicked(null);
      setChecked(false);
      setSkipped(false);
      setFeedback(null);
      return;
    }
    const byLevel: Record<WordLevel, [number, number]> = { basic: [0, 0], intermediate: [0, 0], advanced: [0, 0] };
    questions.forEach((question, i) => {
      byLevel[question.level][1] += 1;
      if (results[i]) byLevel[question.level][0] += 1;
    });
    // Jawaban mentah ikut disimpan: skor asli dinilai ulang server saat daftar.
    const placementResponses = questions.map((question, i) => ({ id: question.id, choice: picks[i] ?? null }));
    saveOnboarding({ placement: { score: results.filter(Boolean).length, total: questions.length, byLevel }, placementResponses });
    router.push("/mulai/hasil");
  }

  // Tampilkan titik kosong sebagai garis bawah berisi jawaban terpilih.
  const parts = q.prompt.split(/_{2,}/);

  return (
    <DrillPage>
      <DrillHeader exitHref="/mulai/level" exitLabel="Keluar dari tes penempatan" value={index + (checked ? 1 : 0)} max={questions.length} />
      <DrillMain className="mx-auto flex max-w-[880px] flex-col gap-7">
        <div className="rise flex items-end gap-4">
          <Lori mood={checked ? (right ? "cheer" : "sad") : "talk"} size={120} className="shrink-0" />
          <div className="mb-7 rounded-[18px_18px_18px_4px] border-2 border-hairline bg-surface px-[18px] py-3.5 shadow-[0_4px_0_var(--color-hairline)]">
            <p className="text-[1rem] font-semibold">
              Tenang, ini bukan ujian. Kalau nggak tahu, pilih <strong>“Belum tahu”</strong> aja biar hasilnya akurat.
            </p>
          </div>
        </div>

        <section key={index} className="rise flex flex-col gap-[18px] [--i:1]">
          <p className="inline-flex self-start rounded-[10px] bg-sky-soft px-3 py-1.5 text-[0.8125rem] font-extrabold tracking-[0.06em] text-sky-deep">
            STRUCTURE · SOAL {index + 1} · {LEVEL_LABEL[q.level]}
          </p>
          <h1 className="font-display text-[1.75rem] font-extrabold leading-snug tracking-[-0.02em] sm:text-[2.125rem]">
            {parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 ? (
                  <span className="inline-block min-w-[150px] border-b-4 border-ink px-2 text-center text-sky-deep">{picked ?? " "}</span>
                ) : null}
              </span>
            ))}
          </h1>
          <div role="radiogroup" aria-label="Pilihan jawaban" className={cn("grid gap-3.5 sm:grid-cols-2", checked && !right && !skipped && "shake")}>
            {q.options.map((option, i) => {
              const sel = picked === option;
              const isAnswer = checked && isCorrectOption(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  disabled={checked}
                  onClick={() => {
                    setPicked(option);
                    sfx.tap();
                  }}
                  className={cn(
                    "flex min-h-[68px] cursor-pointer items-center gap-3.5 rounded-[18px] border-2 px-[18px] py-3 text-left text-[1.125rem] font-bold transition-[transform,translate,box-shadow] active:translate-y-1 active:shadow-none disabled:cursor-default",
                    !checked && sel && "border-sky bg-sky-soft shadow-[0_4px_0_var(--color-sky)]",
                    !checked && !sel && "border-hairline bg-surface shadow-[0_4px_0_var(--color-hairline)] hover:border-sky",
                    isAnswer && "border-primary bg-primary-soft shadow-[0_4px_0_var(--color-primary)]",
                    checked && sel && !isAnswer && "border-brick bg-brick-soft shadow-[0_4px_0_var(--color-brick)]",
                    checked && !sel && !isAnswer && "border-hairline bg-surface opacity-60",
                  )}
                >
                  <span aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-[10px] border-2 border-current font-display text-[1rem] font-extrabold">
                    {isAnswer ? <Check className="size-4" strokeWidth={3} /> : checked && sel ? <X className="size-4" strokeWidth={3} /> : String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        </section>
      </DrillMain>

      {checked ? (
        <FeedbackBar
          tone={right ? "right" : "wrong"}
          title={skipped ? "Oke, dicatat!" : right ? "Tepat!" : "Belum tepat"}
          body={right ? "Bagus, lanjut ke soal berikutnya." : feedback?.keys.length ? `Jawaban: ${feedback.keys.join(" / ")}` : "Lanjut ke soal berikutnya."}
        >
          <PrimaryButton onClick={next} autoFocus className={cn("gap-2", !right && "bg-ink-subtle [--ledge:var(--color-ink)]")}>
            {index + 1 < questions.length ? "LANJUT" : "LIHAT HASIL"}
            <ArrowRight className="size-5" aria-hidden />
          </PrimaryButton>
        </FeedbackBar>
      ) : (
        <DrillFooter>
          <SecondaryButton onClick={() => check(true)} disabled={checking} className="text-ink-subtle">
            BELUM TAHU
          </SecondaryButton>
          <PrimaryButton
            onClick={() => check(false)}
            disabled={!picked || checking}
            className={picked && !checking ? undefined : "bg-hairline text-ink-faint [--ledge:transparent]"}
          >
            {checking ? "MEMERIKSA…" : "PERIKSA"}
          </PrimaryButton>
        </DrillFooter>
      )}
    </DrillPage>
  );
}
