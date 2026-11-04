"use client";

import {
  GraduationCap,
  Headphones,
  MessageCircle,
  Mic,
  PenLine,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Lori } from "@/components/mascot";
import { SkillChip } from "@/components/ui/badge";
import { SPEAKING_PROMPTS } from "@/lib/speaking-prompts";
import { triedTopicCount, type SpeakingBest } from "@/lib/speaking-scores";
import { cn } from "@/lib/utils";

import { SpeakingTopicPicker } from "./ucapkan/topic-picker";

type SkillId = "structure" | "listening" | "speaking" | "kosakata" | "reading";

type Mode = {
  title: string;
  desc: string;
  skill: string;
  sid: SkillId;
  meta: string;
  xp: string;
  href: string;
  Icon: LucideIcon | null;
  glyph?: string;
  tone: string;
  isNew?: boolean;
};

const MODES: Mode[] = [
  { title: "Susun kalimat & soal", desc: "Isian, pilihan ganda, susun kata. Acak lintas materi.", skill: "Structure", sid: "structure", meta: "12 soal", xp: "+5/soal", href: "/latihan/soal", Icon: PenLine, tone: "bg-primary-soft text-primary" },
  { title: "Dengar & jawab", desc: "Dengarkan kalimat, pilih kata yang tertangkap. Bisa 0.75×.", skill: "Listening", sid: "listening", meta: "8 kalimat", xp: "+40 penuh", href: "/latihan/dengar", Icon: Headphones, tone: "bg-sky-soft text-sky" },
  { title: "Ucapkan", desc: "Pilih topik, ucapkan 5 kalimat, lihat kata yang belum terdengar jelas.", skill: "Speaking", sid: "speaking", meta: `${SPEAKING_PROMPTS.length} topik`, xp: "+20 maks", href: "/latihan/ucapkan", Icon: Mic, tone: "bg-sky-soft text-sky", isNew: true },
  { title: "Cocokkan pasangan", desc: "Adu cepat jodohkan kata dan arti. Combo bikin skor naik.", skill: "Kosakata", sid: "kosakata", meta: "6 pasang", xp: "+40 tanpa salah", href: "/latihan/pasangan", Icon: null, glyph: "A↔a", tone: "bg-mango-soft text-mango-deep" },
  { title: "Kartu SRS", desc: "Ulang kata tepat sebelum kamu lupa, dengan 4 tingkat ingatan.", skill: "Kosakata", sid: "kosakata", meta: "SRS", xp: "+3/kartu", href: "/kosakata/review", Icon: null, glyph: "Aa", tone: "bg-mango-soft text-mango-deep" },
  { title: "Soal EPrT per topik", desc: "Pilih satu bagian tes, kerjakan dengan timer asli.", skill: "Reading", sid: "reading", meta: "10 soal", xp: "+5/soal", href: "/eptr", Icon: GraduationCap, tone: "bg-charcoal text-mango" },
  { title: "Ngobrol skenario", desc: "Role-play interview, presentasi, sampai check-in hotel bersama Lori.", skill: "Speaking", sid: "speaking", meta: "±10 mnt", xp: "+20 selesai", href: "/tutor/skenario", Icon: MessageCircle, tone: "bg-primary-soft text-primary" },
];

const SKILLS: { id: "all" | SkillId; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "structure", label: "Structure" },
  { id: "listening", label: "Listening" },
  { id: "speaking", label: "Speaking" },
  { id: "kosakata", label: "Kosakata" },
  { id: "reading", label: "Reading" },
];

const CHIP_SKILL = { structure: "structure", listening: "listening", speaking: "speaking", kosakata: "vocab", reading: "reading" } as const;

function recTone(href: string) {
  if (href.startsWith("/kosakata")) return "border-mango-line bg-mango-soft text-mango-ink";
  if (href.startsWith("/latihan/kesalahan")) return "border-brick-line bg-brick-soft text-brick-deep";
  return "border-primary-line bg-primary-soft text-primary-deep";
}

export function PracticeHub({
  dueCount,
  openMistakes,
  topPattern,
  recommendations,
  recent,
  speakingBest = {},
}: {
  dueCount: number;
  openMistakes: number;
  topPattern: { title: string; open: number } | null;
  recommendations: { text: string; href: string }[];
  recent: { id: number; detail: string }[];
  speakingBest?: SpeakingBest;
}) {
  const [skill, setSkill] = useState<"all" | SkillId>("all");
  const modes = MODES.filter((m) => skill === "all" || m.sid === skill);
  const speakingTried = triedTopicCount(
    speakingBest,
    SPEAKING_PROMPTS.map((prompt) => prompt.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="rise flex flex-col gap-1.5">
          <p className="eyebrow text-ink-subtle">Latihan bebas</p>
          <h1 className="font-display text-[2rem] font-black leading-[1.1] tracking-[-0.02em] sm:text-[2.25rem]">Kamu yang atur menunya</h1>
          <p className="text-ink-subtle">Di luar jalur. XP tetap dihitung, streak tetap jalan.</p>
        </div>
        <div role="radiogroup" aria-label="Filter skill" className="flex flex-wrap gap-2">
          {SKILLS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={skill === s.id}
              onClick={() => setSkill(s.id)}
              className={cn(
                "h-10 cursor-pointer rounded-full border-2 px-3.5 text-[0.875rem] transition-colors",
                skill === s.id ? "border-ink bg-ink font-extrabold text-white" : "border-hairline bg-surface font-bold text-ink-muted hover:border-hairline-strong",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <section
        aria-label="Rekomendasi Lori"
        className="rise flex flex-wrap items-center gap-6 rounded-hero border-2 border-hairline bg-surface p-6 shadow-card [--i:1]"
      >
        <div className="flex shrink-0 items-center gap-3">
          <Lori mood="think" size={88} />
          <div>
            <span className="eyebrow block text-primary-deep">Rekomendasi Lori</span>
            <strong className="block max-w-[220px] font-display text-[1.25rem] leading-tight">
              {dueCount + openMistakes > 0 ? "Mulai dari yang paling butuh perhatian" : "Sesi campur untuk menjaga ritme"}
            </strong>
          </div>
        </div>
        <ol className="grid min-w-0 flex-[1_1_420px] gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {recommendations.map((r, i) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className={cn(
                  "flex h-full items-center gap-2.5 rounded-[16px] border-2 p-3.5 transition-transform active:translate-y-0.5",
                  recTone(r.href),
                )}
              >
                <span className="font-round text-[1.375rem] font-extrabold">{i + 1}</span>
                <span className="text-[0.875rem] font-extrabold leading-snug">{r.text}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {skill === "speaking" ? (
        <section
          aria-labelledby="topik-speaking"
          className="rise flex flex-col gap-4 rounded-hero border-2 border-hairline bg-surface-muted p-5 sm:p-6 [--i:2]"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-1">
              <h2 id="topik-speaking" className="font-display text-[1.375rem] font-black leading-tight">
                Langsung pilih topik ngomong
              </h2>
              <p className="text-[0.875rem] text-ink-subtle">
                {speakingTried}/{SPEAKING_PROMPTS.length} topik sudah dicoba · tiap topik 5 kalimat model.
              </p>
            </div>
            <Link href="/latihan/ucapkan" className="text-[0.875rem] font-extrabold text-primary hover:underline">
              Buka halaman topik
            </Link>
          </div>
          <SpeakingTopicPicker
            topics={SPEAKING_PROMPTS}
            best={speakingBest}
            hrefFor={(id) => `/latihan/ucapkan?topic=${id}`}
          />
        </section>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section aria-label="Mode latihan" className="min-w-0 flex-1">
          <p aria-live="polite" className="sr-only">
            {modes.length} mode latihan cocok dengan filtermu
          </p>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
            {modes.map((m, i) => (
              <Link
                key={m.title}
                href={m.href}
                className="pop relative flex flex-col gap-2.5 rounded-[22px] border-2 border-hairline bg-surface p-5 text-ink shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                style={{ "--i": i } as React.CSSProperties}
              >
                {m.isNew ? (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-mango px-2.5 py-0.5 text-[0.6875rem] font-extrabold text-mango-on">
                    BARU
                  </span>
                ) : null}
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("grid size-12 place-items-center rounded-[14px]", m.tone)}>
                    {m.Icon ? (
                      <m.Icon className="size-6" strokeWidth={2.2} aria-hidden />
                    ) : (
                      <span className="font-display text-[0.9375rem] font-black">{m.glyph}</span>
                    )}
                  </span>
                  <SkillChip skill={CHIP_SKILL[m.sid]}>{m.skill}</SkillChip>
                </span>
                <strong className="font-display text-[1.1875rem] leading-tight">{m.title}</strong>
                <span className="text-[0.875rem] text-ink-subtle">{m.desc}</span>
                <span className="mt-auto flex gap-3 text-[0.8125rem] font-extrabold text-ink-muted">
                  <span>{m.href === "/kosakata/review" && dueCount > 0 ? `${dueCount} jatuh tempo` : m.meta}</span>
                  <span className="text-mango-deep">{m.xp}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0">
          <Link
            href="/latihan/kesalahan"
            className="rise flex flex-col gap-3 rounded-[22px] border-2 border-brick-line bg-surface p-5 shadow-[0_4px_0_var(--color-brick-line)] transition-transform [--i:2] active:translate-y-1 active:shadow-none"
          >
            <span className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-[14px] bg-brick-soft text-brick">
                <RotateCcw className="size-[22px]" strokeWidth={2.4} aria-hidden />
              </span>
              <span>
                <strong className="block font-display text-[1.125rem]">Bank Kesalahan</strong>
                <span className="text-[0.875rem] font-bold text-brick-deep">
                  {openMistakes > 0 ? `${openMistakes} kesalahan belum ditebus` : "Belum ada kesalahan yang menunggu"}
                </span>
              </span>
            </span>
            {topPattern ? (
              <span className="flex justify-between text-[0.875rem]">
                <span>{topPattern.title}</span>
                <strong>{topPattern.open}</strong>
              </span>
            ) : null}
            {openMistakes > 0 ? <span className="text-[0.875rem] font-extrabold text-brick-deep">Tebus sekarang · +5/soal</span> : null}
          </Link>

          <div className="rise flex flex-col gap-2.5 rounded-[22px] border-2 border-hairline bg-surface p-5 [--i:3]">
            <span className="eyebrow text-ink-subtle">Baru saja kamu kerjakan</span>
            {recent.length === 0 ? (
              <p className="text-[0.9375rem] text-ink-subtle">Belum ada aktivitas. Pilih satu mode di samping.</p>
            ) : (
              <ul className="flex flex-col">
                {recent.map((r, i) => (
                  <li key={r.id} className={cn("py-2 text-[0.875rem]", i > 0 && "border-t-2 border-hairline-soft")}>
                    {r.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
