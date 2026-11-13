"use client";

import { Check, ChevronDown, Dices, Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  PROMPT_KIND_LABEL,
  PROMPT_LEVEL_LABEL,
  PROMPT_LEVELS,
  randomUnusedPrompt,
  WRITING_PROMPTS,
  type PromptLevel,
  type WritingPrompt,
} from "@/lib/writing-prompts";
import { cn } from "@/lib/utils";

type Props = {
  daily: WritingPrompt;
  /** Judul prompt yang sudah pernah ditulis pengguna. */
  used: string[];
  selected: WritingPrompt | null;
  onSelect: (prompt: WritingPrompt | null) => void;
};

export function PromptBank({ daily, used, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<PromptLevel | "semua">("semua");
  const written = new Set(used.map((title) => title.trim().toLowerCase()));
  const isUsed = (prompt: WritingPrompt) => written.has(prompt.title.toLowerCase());
  const rows = WRITING_PROMPTS.filter((prompt) => level === "semua" || prompt.level === level);
  const remaining = WRITING_PROMPTS.filter((prompt) => !isUsed(prompt)).length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2.5 rounded-[18px] border-2 border-dashed border-mango-line bg-mango-soft/60 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="eyebrow flex items-center gap-1.5 text-mango-ink">
            <Sparkles className="size-3.5" aria-hidden />
            Prompt hari ini
          </span>
          <span className="flex flex-wrap gap-1.5">
            <Badge>{PROMPT_LEVEL_LABEL[daily.level]}</Badge>
            <Badge>{PROMPT_KIND_LABEL[daily.kind]}</Badge>
          </span>
        </div>
        <p className="font-display text-[1rem] font-extrabold leading-snug text-ink">{daily.title}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.8125rem] font-bold text-ink-subtle">
            target ±{daily.minWords} kata{isUsed(daily) ? " · sudah pernah kamu tulis" : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="reward" onClick={() => onSelect(daily)}>
              Pakai prompt
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const next = randomUnusedPrompt(used);
                onSelect(next);
              }}
            >
              <Dices className="size-4" aria-hidden />
              Acak
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="bank-prompt"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-hairline bg-surface px-3.5 text-[0.875rem] font-extrabold text-ink-muted hover:border-primary-line hover:text-primary-deep"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          Bank prompt
          <span className="rounded-full bg-canvas px-2 py-0.5 text-[0.75rem] text-ink-subtle">{remaining} tersisa</span>
        </button>
        {selected ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-[0.8125rem] font-bold text-ink-subtle hover:text-brick-deep"
          >
            <X className="size-3.5" aria-hidden />
            Lepas prompt
          </button>
        ) : null}
      </div>

      {selected ? (
        <div className="rise flex flex-col gap-2 rounded-[18px] border-2 border-primary-line bg-primary-soft p-3.5">
          <span className="eyebrow text-primary-deep">
            Prompt dipilih · {PROMPT_LEVEL_LABEL[selected.level]} · {PROMPT_KIND_LABEL[selected.kind]}
          </span>
          <p className="text-[0.9375rem] font-extrabold leading-snug text-ink">{selected.title}</p>
          <ul className="flex flex-col gap-1.5">
            {selected.hints.map((hint) => (
              <li key={hint} className="flex items-start gap-2 text-[0.875rem] leading-snug text-primary-deep">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
                {hint}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {open ? (
        <div id="bank-prompt" className="rise flex flex-col gap-3 rounded-[18px] border-2 border-hairline bg-surface p-3.5">
          <div role="group" aria-label="Filter level prompt" className="flex flex-wrap gap-1.5">
            {(["semua", ...PROMPT_LEVELS] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={level === option}
                onClick={() => setLevel(option)}
                className={cn(
                  "h-11 cursor-pointer rounded-full border-2 px-3 text-[0.8125rem] font-extrabold",
                  level === option
                    ? "border-primary-line bg-primary-soft text-primary-deep"
                    : "border-hairline bg-surface text-ink-subtle hover:border-hairline-strong hover:text-ink",
                )}
              >
                {option === "semua" ? "Semua level" : PROMPT_LEVEL_LABEL[option]}
              </button>
            ))}
          </div>

          <ul className="grid max-h-[290px] gap-2 overflow-y-auto pr-1 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
            {rows.map((prompt) => {
              const on = selected?.id === prompt.id;
              return (
                <li key={prompt.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      onSelect(prompt);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex h-full w-full cursor-pointer flex-col items-start gap-1.5 rounded-[14px] border-2 p-3 text-left",
                      on ? "border-primary bg-primary-soft" : "border-hairline bg-surface-muted hover:border-primary-line",
                    )}
                  >
                    <span className="flex w-full flex-wrap items-center gap-1.5">
                      <Badge>{PROMPT_LEVEL_LABEL[prompt.level]}</Badge>
                      <Badge>{PROMPT_KIND_LABEL[prompt.kind]}</Badge>
                      {isUsed(prompt) ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-[0.75rem] font-extrabold text-primary-deep">
                          <Check className="size-3" aria-hidden />
                          sudah ditulis
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[0.875rem] font-extrabold leading-snug text-ink">{prompt.title}</span>
                    <span className="text-[0.75rem] text-ink-subtle">{prompt.topic}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-surface px-2 py-0.5 text-[0.75rem] font-extrabold text-ink-subtle">{children}</span>
  );
}
