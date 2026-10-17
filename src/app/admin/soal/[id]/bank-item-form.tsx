"use client";

import { useActionState } from "react";

import { Kaka } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import type { Verdict } from "@/lib/calibration";
import { cn } from "@/lib/utils";

import { saveBankItemAction, type FormState } from "../../actions";

type QuestionView = {
  q: string;
  options: string[];
  answer: number;
  explain: string;
  audio: string[];
  attempts: number;
  correct: number;
  verdict: Verdict;
};

const VERDICT: Record<Verdict, { label: string; tone: string }> = {
  faulty: { label: "Kunci bermasalah", tone: "bg-brick-soft text-brick-deep" },
  "too-easy": { label: "Terlalu mudah", tone: "bg-mango-soft text-mango-ink" },
  ok: { label: "Sesuai", tone: "bg-primary-soft text-primary-deep" },
  unknown: { label: "Data kurang", tone: "bg-surface-muted text-ink-subtle" },
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function BankItemForm({
  id,
  levelBand,
  passage,
  questions,
}: {
  id: number;
  levelBand: string;
  passage: string | null;
  questions: QuestionView[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBankItemAction, {});
  // Setelah galat, tampilkan isian terakhir yang dikirim, bukan isi database.
  const sent = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  return (
    <form key={state.nonce ?? "awal"} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="count" value={questions.length} />

      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="levelBand">Level</Label>
          <select id="levelBand" name="levelBand" defaultValue={sent("levelBand", levelBand)} className="h-11 rounded-control border-2 border-hairline bg-surface px-3 font-bold">
            <option value="low">low · target 60–85%</option>
            <option value="mid">mid · target 50–75%</option>
            <option value="high">high · target 40–65%</option>
          </select>
        </div>
        <p className="flex-1 text-[0.8125rem] text-ink-subtle">
          Penjelasan tiap soal wajib diisi. Tulis seperti Lori bicara: kenapa kunci benar, dan kenapa pengecoh yang paling sering dipilih itu menjebak.
        </p>
      </Card>

      {passage !== null ? (
        <Card className="flex flex-col gap-2 p-5">
          <Label htmlFor="passage">Bacaan</Label>
          <Textarea id="passage" name="passage" rows={8} defaultValue={sent("passage", passage)} className="font-serif text-[1rem]" />
          <p className="text-[0.75rem] text-ink-subtle">Mengubah bacaan mereset statistik semua soal di bawahnya.</p>
        </Card>
      ) : null}

      {questions.map((question, i) => {
        const verdict = VERDICT[question.verdict];
        const rate = question.attempts ? Math.round((question.correct / question.attempts) * 100) : null;
        const key = Number(sent(`answer-${i}`, String(question.answer)));
        return (
          <Card key={i} className="flex flex-col gap-3 p-5">
            <input type="hidden" name={`optcount-${i}`} value={question.options.length} />
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-extrabold">Soal {i + 1}</h2>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold", verdict.tone)}>{verdict.label}</span>
              <span className="tnum text-[0.8125rem] text-ink-subtle">
                {question.attempts} jawaban{rate !== null ? ` · ${rate}% benar` : ""}
              </span>
            </div>
            {question.audio.length ? (
              <div className="rounded-control bg-surface-muted p-3 text-[0.8125rem]">
                <p className="font-bold">Transkrip audio (tidak bisa disunting di sini)</p>
                {question.audio.map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`q-${i}`}>Teks soal</Label>
              <Textarea id={`q-${i}`} name={`q-${i}`} rows={2} defaultValue={sent(`q-${i}`, question.q)} required />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[0.875rem] font-bold">Pilihan · pilih lingkaran untuk kunci jawaban</legend>
              {question.options.map((option, j) => (
                <div key={j} className="flex items-center gap-2">
                  <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-hairline has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-white">
                    <input type="radio" name={`answer-${i}`} value={j} defaultChecked={j === key} className="sr-only" required />
                    <span className="font-display font-extrabold">{LETTERS[j] ?? j + 1}</span>
                    <span className="sr-only">Jadikan pilihan {LETTERS[j] ?? j + 1} kunci jawaban</span>
                  </label>
                  <label htmlFor={`opt-${i}-${j}`} className="sr-only">Teks pilihan {LETTERS[j] ?? j + 1}</label>
                  <Input id={`opt-${i}-${j}`} name={`opt-${i}-${j}`} defaultValue={sent(`opt-${i}-${j}`, option)} required className="h-11" />
                </div>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`explain-${i}`}>Penjelasan Lori</Label>
              <Textarea id={`explain-${i}`} name={`explain-${i}`} rows={3} defaultValue={sent(`explain-${i}`, question.explain)} required minLength={20} />
            </div>
          </Card>
        );
      })}

      <div className="sticky bottom-4 flex flex-wrap items-center gap-4 rounded-plate border-2 border-hairline bg-surface p-4 shadow-overlay">
        <Kaka mood={state.error ? "warn" : "coach"} size={56} />
        <div className="min-w-0 flex-1">
          <FieldError>{state.error}</FieldError>
          {!state.error ? <p className="text-[0.875rem] text-ink-subtle">Perubahan tercatat di log audit.</p> : null}
        </div>
        <button type="submit" disabled={pending} className={buttonVariants()}>
          {pending ? "Menyimpan…" : "Simpan soal"}
        </button>
      </div>
    </form>
  );
}
