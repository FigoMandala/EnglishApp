"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { ESSAY_MAX_WORDS, ESSAY_MIN_WORDS, wordCount } from "@/lib/writing";
import { cn } from "@/lib/utils";

import { submitEssayAction, type WritingState } from "./actions";

const initialState: WritingState = { status: "idle" };

const PROMPT_EXAMPLES = [
  "Should students use AI tools for homework?",
  "The impact of social media on young people",
  "Why public transport matters for big cities",
];

const DRAFT_KEY = "writing-draft";

export function EssayForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitEssayAction, initialState);
  const [essay, setEssay] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const words = wordCount(essay);
  const tooShort = words > 0 && words < ESSAY_MIN_WORDS;
  const tooLong = words > ESSAY_MAX_WORDS;

  // Pulihkan draf yang belum terkirim (misalnya halaman tertutup saat AI menilai).
  useEffect(() => {
    try {
      const draft = window.localStorage.getItem(DRAFT_KEY);
      if (draft) {
        setEssay(draft);
        setRestored(true);
      }
    } catch {
      // Penyimpanan diblokir: draf tidak dipulihkan, tidak masalah.
    }
  }, []);

  // Simpan draf setiap kali berubah, hapus saat esai sudah tersimpan di server.
  useEffect(() => {
    try {
      if (savedId) window.localStorage.removeItem(DRAFT_KEY);
      else if (essay.trim()) window.localStorage.setItem(DRAFT_KEY, essay);
      else window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // abaikan
    }
  }, [essay, savedId]);

  // Setelah sukses, server mengembalikan id esai di `message`.
  useEffect(() => {
    if (state.status === "idle" && state.message && /^\d+$/.test(state.message)) {
      setSavedId(state.message);
      setEssay("");
      router.push(`/writing/${state.message}`);
    }
    // state berubah saat action selesai; efek ini hanya menangani kasus sukses.
  }, [state, router]);

  return (
    <form action={formAction} className="clay flex flex-col gap-4 p-6 sm:p-7">
      <div className="flex flex-col gap-2">
        <Label htmlFor="prompt">Topik esai (opsional)</Label>
        <Input id="prompt" name="prompt" maxLength={300} placeholder="mis. Should students use AI tools for homework?" />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PROMPT_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={(event) => {
                const input = event.currentTarget.form?.elements.namedItem("prompt");
                if (input instanceof HTMLInputElement) input.value = example;
              }}
              className="rounded-full border border-hairline bg-surface-muted px-3 py-1 text-[0.75rem] font-semibold text-ink-subtle transition-colors hover:border-primary hover:text-primary"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="essay">Esai (Bahasa Inggris)</Label>
          <span
            className={cn(
              "tnum text-[0.75rem] font-bold",
              tooShort || tooLong ? "text-warning" : "text-ink-faint",
            )}
          >
            {words} kata · {ESSAY_MIN_WORDS}–{ESSAY_MAX_WORDS}
          </span>
        </div>
        <Textarea
          id="essay"
          name="essay"
          value={essay}
          onChange={(event) => setEssay(event.target.value)}
          required
          minLength={1}
          rows={14}
          maxLength={8_000}
          placeholder="Write your essay in English…"
          className={cn("min-h-[320px] text-[0.9375rem] leading-relaxed", (tooShort || tooLong) && "border-warning")}
          aria-describedby="essay-count-hint"
        />
        {restored && essay.trim() && !savedId ? (
          <p role="status" className="text-[0.75rem] text-ink-faint">
            Draf sebelumnya dipulihkan otomatis. Tersimpan lokal tiap kali kamu mengetik.
          </p>
        ) : null}
        <span id="essay-count-hint" className="sr-only">
          Panjang esai antara {ESSAY_MIN_WORDS} dan {ESSAY_MAX_WORDS} kata.
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" disabled={pending || tooShort || tooLong || words === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {pending ? "Menilai esai…" : "Nilai esai saya"}
        </Button>
        {pending ? (
          <p role="status" className="text-[0.8125rem] text-ink-subtle">
            Biasanya 20–60 detik. Jangan tutup halaman.
          </p>
        ) : null}
      </div>

      <FieldError>{state.status === "error" ? state.message : undefined}</FieldError>
      {savedId ? (
        <p role="status" className="text-[0.875rem] font-semibold text-primary">
          Esai tersimpan, membuka hasil penilaian…
        </p>
      ) : null}
    </form>
  );
}
