"use client";

import { ArrowLeft, CheckCircle2, Lightbulb, Loader2, PenLine } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import {
  ASPECT_HINT,
  ASPECT_LABEL,
  ESSAY_MAX_CHARS,
  PARAGRAPH_MAX_WORDS,
  PARAGRAPH_MIN_WORDS,
  wordCount,
  type WritingAspect,
} from "@/lib/writing";
import { PROMPT_KIND_LABEL, PROMPT_LEVEL_LABEL, type WritingPrompt } from "@/lib/writing-prompts";
import { cn } from "@/lib/utils";

import { reviewParagraphAction, type ParagraphState } from "../actions";
import { PromptBank } from "../prompt-bank";

type Step = "pilih" | "tulis" | "hasil";

export function ParagraphDrill({ daily }: { daily: WritingPrompt }) {
  const [step, setStep] = useState<Step>("pilih");
  const [selected, setSelected] = useState<WritingPrompt | null>(null);
  const [outline, setOutline] = useState({ main: "", detail1: "", detail2: "" });
  const [paragraph, setParagraph] = useState("");
  const [state, setState] = useState<ParagraphState | null>(null);
  const [xp, setXp] = useState(0);
  const [pending, startTransition] = useTransition();

  const words = wordCount(paragraph);
  const ready = words >= PARAGRAPH_MIN_WORDS && words <= PARAGRAPH_MAX_WORDS;
  const score = state?.status === "done" ? state.score : null;

  function submit() {
    if (pending || !ready) return;
    setState(null);
    startTransition(async () => {
      const result = await reviewParagraphAction({
        prompt: selected?.title ?? "",
        outline: [outline.main, outline.detail1, outline.detail2].filter((line) => line.trim()).join("\n"),
        paragraph,
      });
      setState(result);
      if (result.status === "done") {
        setStep("hasil");
        // XP diberikan langsung oleh action review setelah AI menilai.
        setXp(result.xp);
      }
    });
  }

  if (step === "pilih") {
    return (
      <div className="flex flex-col gap-4">
        <PromptBank daily={daily} used={[]} selected={selected} onSelect={setSelected} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => setStep("tulis")} disabled={!selected}>
            <PenLine className="size-4" aria-hidden />
            Tulis paragraf ini
          </Button>
          <span className="text-[0.8125rem] text-ink-subtle">
            {selected
              ? `${PROMPT_LEVEL_LABEL[selected.level]} · ${PARAGRAPH_MIN_WORDS}–${PARAGRAPH_MAX_WORDS} kata`
              : "Pilih satu prompt dulu, atau pakai prompt hari ini."}
          </span>
        </div>
      </div>
    );
  }

  if (step === "hasil" && score) {
    return (
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4 rounded-[24px] border-2 border-hairline bg-surface p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className={cn(
                "grid size-[92px] shrink-0 place-items-center rounded-[22px]",
                score.total >= 70 ? "bg-primary-soft" : score.total >= 50 ? "bg-mango-soft" : "bg-brick-soft",
              )}
            >
              <span
                className={cn(
                  "tnum font-round text-[2.25rem] font-extrabold leading-none",
                  score.total >= 70 ? "text-primary-deep" : score.total >= 50 ? "text-mango-ink" : "text-brick-deep",
                )}
              >
                {score.total}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-ink-subtle">Skor paragraf · {words} kata</p>
              <p className="text-[1rem] font-extrabold leading-snug text-ink">{selected?.title}</p>
              <p className="mt-1 text-[0.9375rem] leading-snug text-ink-muted">
                {score.summary || "Paragrafmu sudah dinilai. Lihat catatan per aspek di bawah."}
              </p>
              {xp > 0 ? (
                <p className="mt-1 text-[0.8125rem] font-extrabold text-mango-ink">
                  +{xp} XP masuk ke progres hari ini
                </p>
              ) : null}
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {score.aspects.map((aspect) => (
              <li key={aspect.aspect} className="flex flex-col gap-1 rounded-[16px] border-2 border-hairline bg-surface-muted p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-[0.9375rem] font-extrabold">
                    {ASPECT_LABEL[aspect.aspect as WritingAspect] ?? aspect.aspect}
                  </span>
                  <span
                    className={cn(
                      "tnum font-round text-[1.125rem] font-extrabold",
                      aspect.score >= 70 ? "text-primary-deep" : aspect.score >= 50 ? "text-mango-ink" : "text-brick-deep",
                    )}
                  >
                    {aspect.score}
                  </span>
                </div>
                <span className="text-[0.75rem] text-ink-subtle">
                  {ASPECT_HINT[aspect.aspect as WritingAspect] ?? ""}
                </span>
                {aspect.note ? <span className="text-[0.8125rem] leading-snug text-ink-muted">{aspect.note}</span> : null}
              </li>
            ))}
          </ul>
        </section>

        {score.corrections.length > 0 ? (
          <section aria-labelledby="koreksi-title" className="flex flex-col gap-2.5">
            <h2 id="koreksi-title" className="font-display text-[1.125rem] font-extrabold">
              Koreksi kalimat
            </h2>
            <ul className="flex flex-col gap-2">
              {score.corrections.map((correction, index) => (
                <li key={index} className="flex flex-col gap-1 rounded-[16px] border-2 border-hairline bg-surface p-3.5">
                  <p className="text-[0.875rem] leading-snug text-brick-deep">
                    <span className="font-extrabold">Asli: </span>
                    {correction.original}
                  </p>
                  <p className="text-[0.875rem] leading-snug text-primary-deep">
                    <span className="font-extrabold">Perbaikan: </span>
                    {correction.correction}
                  </p>
                  {correction.reason ? (
                    <p className="text-[0.75rem] leading-snug text-ink-subtle">{correction.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {score.strengths.length > 0 ? (
            <section className="flex flex-col gap-2 rounded-[18px] border-2 border-primary-line bg-primary-soft p-4">
              <h2 className="flex items-center gap-2 font-display text-[1rem] font-extrabold text-primary-deep">
                <CheckCircle2 className="size-4" aria-hidden />
                Yang sudah bagus
              </h2>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.875rem] leading-snug text-ink-muted">
                {score.strengths.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {score.improvements.length > 0 ? (
            <section className="flex flex-col gap-2 rounded-[18px] border-2 border-mango-line bg-mango-soft p-4">
              <h2 className="flex items-center gap-2 font-display text-[1rem] font-extrabold text-mango-ink">
                <Lightbulb className="size-4" aria-hidden />
                Saran perbaikan
              </h2>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.875rem] leading-snug text-ink-muted">
                {score.improvements.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => setStep("tulis")}>
            <ArrowLeft className="size-4" aria-hidden />
            Tulis ulang
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setStep("pilih");
              setSelected(null);
              setParagraph("");
              setOutline({ main: "", detail1: "", detail2: "" });
              setState(null);
              setXp(0);
            }}
          >
            Prompt lain
          </Button>
          <Link href="/writing" className={buttonVariants({ variant: "primary" })}>
            Kembali ke Writing Coach
          </Link>
        </div>
        <p className="text-[0.75rem] text-ink-subtle">
          Latihan kilat dicatat sebagai aktivitas (+XP, maks 60 XP/hari), tapi isi paragrafnya tidak masuk riwayat esai.
          Salin catatannya kalau mau kamu pakai untuk esai penuh.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setStep("pilih")}
            className="inline-flex cursor-pointer items-center gap-1.5 text-[0.8125rem] font-extrabold text-ink-subtle hover:text-primary-deep"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Ganti prompt
          </button>
          <span className="text-[0.75rem] font-extrabold uppercase tracking-[0.06em] text-ink-subtle">
            {selected ? `${PROMPT_LEVEL_LABEL[selected.level]} · ${PROMPT_KIND_LABEL[selected.kind]}` : "Paragraf kilat"}
          </span>
          <p className="font-display text-[1.25rem] font-extrabold leading-snug text-ink">
            {selected?.title ?? "Topik bebas"}
          </p>
        </div>
        <span className="tnum shrink-0 rounded-full bg-mango-soft px-3 py-1 text-[0.8125rem] font-extrabold text-mango-ink">
          {words >= PARAGRAPH_MIN_WORDS ? `${words} kata · siap dinilai` : `${words} / ${PARAGRAPH_MIN_WORDS} kata`}
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-[18px] border-2 border-dashed border-hairline-strong bg-surface-muted p-4">
        <p className="text-[0.8125rem] font-extrabold text-ink-muted">Kerangka dulu (opsional, tapi bikin lebih runtut)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outline-main" className="text-[0.8125rem]">
              Ide pokok
            </Label>
            <Input
              id="outline-main"
              value={outline.main}
              onChange={(event) => setOutline((prev) => ({ ...prev, main: event.target.value }))}
              maxLength={160}
              placeholder="mis. Online learning saves commuting time"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outline-detail1" className="text-[0.8125rem]">
              Alasan / contoh 1
            </Label>
            <Input
              id="outline-detail1"
              value={outline.detail1}
              onChange={(event) => setOutline((prev) => ({ ...prev, detail1: event.target.value }))}
              maxLength={160}
              placeholder="mis. two hours back every day"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outline-detail2" className="text-[0.8125rem]">
              Alasan / contoh 2
            </Label>
            <Input
              id="outline-detail2"
              value={outline.detail2}
              onChange={(event) => setOutline((prev) => ({ ...prev, detail2: event.target.value }))}
              maxLength={160}
              placeholder="mis. can review recorded lectures"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="paragraph">Paragrafmu (English)</Label>
          <span className="text-[0.8125rem] text-ink-subtle">
            target {PARAGRAPH_MIN_WORDS}–{PARAGRAPH_MAX_WORDS} kata
          </span>
        </div>
        <Textarea
          id="paragraph"
          value={paragraph}
          onChange={(event) => setParagraph(event.target.value)}
          maxLength={ESSAY_MAX_CHARS}
          rows={10}
          placeholder="Start with a topic sentence, then support it with the details from your outline…"
        />
        <div
          role="progressbar"
          aria-label="Panjang paragraf"
          aria-valuemin={0}
          aria-valuemax={PARAGRAPH_MIN_WORDS}
          aria-valuenow={Math.min(words, PARAGRAPH_MIN_WORDS)}
          className="h-2 overflow-hidden rounded-full bg-canvas-deep"
        >
          <div
            className={cn(
              "h-full w-full origin-left rounded-full transition-transform duration-300 ease-[var(--ease-out)]",
              words > PARAGRAPH_MAX_WORDS ? "bg-brick" : words >= PARAGRAPH_MIN_WORDS ? "bg-primary" : "bg-mango",
            )}
            style={{ transform: `scaleX(${Math.min(1, words / PARAGRAPH_MIN_WORDS)})` }}
          />
        </div>
        {words > PARAGRAPH_MAX_WORDS ? (
          <p className="text-[0.8125rem] font-bold text-brick-deep">
            Kepanjangan. Pangkas jadi maksimal {PARAGRAPH_MAX_WORDS} kata supaya tetap satu paragraf.
          </p>
        ) : null}
      </div>

      {state?.status === "error" ? (
        <p role="alert" className="rounded-[12px] bg-brick-soft px-3 py-2 text-[0.875rem] font-bold text-brick-deep">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={submit} disabled={!ready || pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? "Lori sedang membaca…" : "Minta koreksi"}
        </Button>
        <span className="text-[0.8125rem] text-ink-subtle">
          {pending
            ? "Biasanya 10–20 detik."
            : words < PARAGRAPH_MIN_WORDS
              ? `Kurang ${PARAGRAPH_MIN_WORDS - words} kata lagi.`
              : "Sekali kirim, langsung dapat skor dan koreksi."}
        </span>
      </div>
    </div>
  );
}
