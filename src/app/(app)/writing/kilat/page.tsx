import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { PARAGRAPH_MAX_WORDS, PARAGRAPH_MIN_WORDS } from "@/lib/writing";
import { promptOfTheDay } from "@/lib/writing-prompts";

import { ParagraphDrill } from "./paragraph-drill";

export const metadata = { title: "Paragraf kilat · Writing Coach" };

export default async function ParagraphDrillPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <nav aria-label="Remah roti" className="flex items-center gap-2 text-[0.875rem] font-bold text-ink-subtle">
        <Link href="/writing" className="text-ink-muted hover:text-primary">
          Writing Coach
        </Link>
        <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
        <span aria-current="page">Paragraf kilat</span>
      </nav>

      <header className="flex flex-col gap-1.5">
        <p className="eyebrow text-ink-subtle">Latihan singkat</p>
        <h1 className="font-display text-[2rem] font-black leading-[1.1] tracking-[-0.02em]">
          Satu paragraf, satu koreksi
        </h1>
        <p className="text-ink-subtle">
          Susun kerangka, tulis {PARAGRAPH_MIN_WORDS}–{PARAGRAPH_MAX_WORDS} kata, lalu Lori bedah kalimatnya. Cocok buat
          latihan 5 menit sebelum menulis esai penuh.
        </p>
      </header>

      <ParagraphDrill daily={promptOfTheDay(user.id, todayISO())} />
    </div>
  );
}
