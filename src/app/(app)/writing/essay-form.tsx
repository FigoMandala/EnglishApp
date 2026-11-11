"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { ESSAY_MAX_WORDS, ESSAY_MIN_WORDS, wordCount } from "@/lib/writing";
import { findPrompt, type WritingPrompt } from "@/lib/writing-prompts";
import { cn } from "@/lib/utils";

import { submitEssayAction, type WritingState } from "./actions";
import { PromptBank } from "./prompt-bank";

const initialState: WritingState = { status: "idle" };

const DRAFT_KEY = "writing-draft";

export function EssayForm({ daily, usedPrompts }: { daily: WritingPrompt; usedPrompts: string[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitEssayAction, initialState);
  const [essay, setEssay] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const selected = findPrompt(selectedId) ?? null;

  const choosePrompt = (next: WritingPrompt | null) => {
    setSelectedId(next?.id ?? null);
    setPrompt(next?.title ?? "");
  };

  const words = wordCount(essay);
  const tooLong = words > ESSAY_MAX_WORDS;
  const ready = words >= ESSAY_MIN_WORDS && !tooLong;

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
      setPrompt("");
      setSelectedId(null);
      router.push(`/writing/${state.message}`);
    }
    // state berubah saat action selesai; efek ini hanya menangani kasus sukses.
  }, [state, router]);

  return (
    <form
      action={formAction}
      aria-label="Esai baru"
      className="flex min-w-0 flex-[1_1_560px] flex-col gap-[18px] rounded-[28px] border-2 border-hairline bg-surface p-6 shadow-card"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="prompt">
          Topik esai <span className="font-semibold text-ink-subtle">(opsional)</span>
        </Label>
        <Input
          id="prompt"
          name="prompt"
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            if (selectedId && findPrompt(selectedId)?.title !== event.target.value) setSelectedId(null);
          }}
          maxLength={300}
          placeholder="mis. Should students use AI tools for homework?"
        />
        <PromptBank daily={daily} used={usedPrompts} selected={selected} onSelect={choosePrompt} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="essay">Esai (Bahasa Inggris)</Label>
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
          className="min-h-[320px] rounded-[16px] bg-surface-muted px-[18px] py-4 text-[1.0625rem] leading-[1.7]"
          aria-describedby="essay-count-hint"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem] font-bold">
          <span className="text-ink-subtle">
            Minimal {ESSAY_MIN_WORDS} · maksimal {ESSAY_MAX_WORDS} kata
          </span>
          <span className={cn("tnum", ready ? "text-primary-deep" : tooLong ? "text-brick-deep" : "text-mango-ink")}>
            {words} kata · {ready ? "siap dinilai" : tooLong ? "terlalu panjang" : `${ESSAY_MIN_WORDS - words} lagi`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
          <div
            className={cn(
              "h-full w-full origin-left transition-transform duration-300 ease-[var(--ease-out)]",
              ready ? "bg-primary" : tooLong ? "bg-brick" : "bg-mango",
            )}
            style={{ transform: `scaleX(${Math.min(1, words / ESSAY_MIN_WORDS)})` }}
          />
        </div>
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
        <span role={pending ? "status" : undefined} className="text-[0.8125rem] text-ink-subtle">
          {pending ? "Biasanya 20–60 detik. Jangan tutup halaman." : "Draf tersimpan otomatis di perangkat ini."}
        </span>
        <Button type="submit" size="lg" disabled={pending || !ready} className="px-7 tracking-[0.03em]">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {pending ? "MENILAI ESAI…" : "NILAI ESAI SAYA"}
        </Button>
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
