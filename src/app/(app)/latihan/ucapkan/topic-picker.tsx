"use client";

import Link from "next/link";
import { useState } from "react";

import type { SpeakingPrompt } from "@/lib/speaking-prompts";
import type { SpeakingBest } from "@/lib/speaking-scores";
import { PROMPT_LEVELS, PROMPT_LEVEL_LABEL, type PromptLevel } from "@/lib/writing-prompts";
import { cn } from "@/lib/utils";

const CARD =
  "flex h-full w-full cursor-pointer flex-col items-start gap-1.5 rounded-[18px] border-2 border-hairline bg-surface p-4 text-left shadow-[0_4px_0_var(--color-hairline)] transition-transform hover:border-primary-line active:translate-y-1 active:shadow-none";

/**
 * Daftar topik speaking + filter level. Dipakai dua tempat: layar pilih topik di
 * /latihan/ucapkan (mode tombol) dan hub /latihan (mode tautan langsung).
 */
export function SpeakingTopicPicker({
  topics,
  best = {},
  hrefFor,
  onPick,
}: {
  topics: SpeakingPrompt[];
  /** Skor terbaik per topik, ditampilkan sebagai lencana. */
  best?: SpeakingBest;
  /** Kalau diisi, tiap kartu jadi tautan (dipakai hub latihan). */
  hrefFor?: (id: string) => string;
  /** Kalau diisi, tiap kartu jadi tombol yang memulai drill. */
  onPick?: (prompt: SpeakingPrompt) => void;
}) {
  const [level, setLevel] = useState<PromptLevel | "semua">("semua");
  const rows = topics.filter((topic) => level === "semua" || topic.level === level);

  return (
    <div className="flex w-full flex-col gap-4">
      <div role="group" aria-label="Filter level topik" className="flex flex-wrap justify-center gap-2">
        {(["semua", ...PROMPT_LEVELS] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={level === option}
            onClick={() => setLevel(option)}
            className={cn(
              "h-11 cursor-pointer rounded-full border-2 px-4 text-[0.875rem] font-extrabold",
              level === option
                ? "border-primary-line bg-primary-soft text-primary-deep"
                : "border-hairline bg-surface text-ink-subtle hover:border-hairline-strong hover:text-ink",
            )}
          >
            {option === "semua" ? "Semua level" : PROMPT_LEVEL_LABEL[option]}
          </button>
        ))}
      </div>

      <ul className="grid w-full gap-3 sm:grid-cols-2">
        {rows.map((prompt) => {
          const score = best[prompt.id];
          const body = (
            <>
              <span className="flex flex-wrap items-center gap-1.5 text-[0.75rem] font-extrabold text-ink-subtle">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-primary-deep">
                  {PROMPT_LEVEL_LABEL[prompt.level]}
                </span>
                <span className="rounded-full bg-canvas px-2 py-0.5">{prompt.topic}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {score !== undefined ? (
                    <span className="tnum rounded-full bg-mango-soft px-2 py-0.5 text-mango-ink">terbaik {score}</span>
                  ) : null}
                  <span className="text-ink-faint">{prompt.sentences.length} kalimat</span>
                </span>
              </span>
              <span className="font-display text-[1rem] font-extrabold leading-snug text-ink">{prompt.title}</span>
              <span className="text-[0.8125rem] leading-snug text-ink-subtle">{prompt.brief}</span>
            </>
          );

          const href = hrefFor?.(prompt.id);
          return (
            <li key={prompt.id}>
              {href ? (
                <Link href={href} className={CARD}>
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={() => onPick?.(prompt)} className={CARD}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
