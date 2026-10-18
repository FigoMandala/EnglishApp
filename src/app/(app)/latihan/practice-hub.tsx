"use client";

import {
  BookOpenCheck,
  GraduationCap,
  Headphones,
  Layers,
  LayoutGrid,
  MessageCircle,
  Mic,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Mode = {
  title: string;
  desc: string;
  skill: string;
  sid: string;
  xp: string;
  href: string;
  Icon: LucideIcon;
  tone: string;
  isNew?: boolean;
};

const MODES: Mode[] = [
  { title: "Susun kalimat & soal", desc: "Soal grammar acak lintas materi: isian, pilihan ganda, susun kata.", skill: "Structure", sid: "structure", xp: "+5 XP/soal", href: "/latihan/soal", Icon: Layers, tone: "bg-primary-soft text-primary-deep [--l:#9fd0b3]" },
  { title: "Dengar & jawab", desc: "Dengarkan kalimat, pilih kata yang kamu tangkap. Bisa diperlambat 0.75×.", skill: "Listening", sid: "listening", xp: "sampai +40 XP", href: "/latihan/dengar", Icon: Headphones, tone: "bg-[#f1e8f7] text-[#5d2e86] [--l:#d5bfe6]", isNew: true },
  { title: "Ucapkan", desc: "Ucapkan kalimat, lihat kata mana yang belum terdengar jelas.", skill: "Speaking", sid: "speaking", xp: "sampai +20 XP", href: "/latihan/ucapkan", Icon: Mic, tone: "bg-sky-soft text-sky-deep [--l:#bcd3f6]", isNew: true },
  { title: "Cocokkan pasangan", desc: "Adu cepat jodohkan kata dan arti. Combo bikin skor naik.", skill: "Kosakata", sid: "kosakata", xp: "sampai +40 XP", href: "/latihan/pasangan", Icon: LayoutGrid, tone: "bg-mango-soft text-mango-ink [--l:#f2c878]", isNew: true },
  { title: "Kartu SRS", desc: "Ulang kata tepat sebelum kamu lupa, dengan 4 tingkat ingatan.", skill: "Kosakata", sid: "kosakata", xp: "+3 XP/kartu baru", href: "/kosakata/review", Icon: BookOpenCheck, tone: "bg-mango-soft text-mango-ink [--l:#f2c878]" },
  { title: "Soal EPrT per topik", desc: "Pilih satu bagian tes, kerjakan dengan timer asli.", skill: "Reading", sid: "reading", xp: "latihan tes", href: "/eptr", Icon: GraduationCap, tone: "bg-brick-soft text-brick-deep [--l:#efb4a2]" },
  { title: "Ngobrol skenario", desc: "Role-play interview, presentasi, sampai check-in hotel bersama Lori.", skill: "Speaking", sid: "speaking", xp: "tanpa batas", href: "/tutor/skenario", Icon: MessageCircle, tone: "bg-sky-soft text-sky-deep [--l:#bcd3f6]", isNew: true },
];

const SKILLS = [
  { id: "all", label: "Semua" },
  { id: "structure", label: "Structure" },
  { id: "listening", label: "Listening" },
  { id: "speaking", label: "Speaking" },
  { id: "kosakata", label: "Kosakata" },
  { id: "reading", label: "Reading" },
];

export function PracticeHub({
  dueCount,
  openMistakes,
  topPattern,
  recommendations,
  recent,
}: {
  dueCount: number;
  openMistakes: number;
  topPattern: { title: string; open: number } | null;
  recommendations: { text: string; href: string }[];
  recent: { id: number; detail: string }[];
}) {
  const [skill, setSkill] = useState("all");
  const modes = MODES.filter((m) => skill === "all" || m.sid === skill);

  return (
    <div className="flex flex-col gap-7 lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="rise">
          <p className="text-[0.875rem] font-extrabold tracking-[0.08em] text-[#17603c]">LATIHAN BEBAS</p>
          <h1 className="mt-1 font-display text-[2.25rem] font-black tracking-[-0.03em] sm:text-[2.625rem]">Kamu yang atur menunya</h1>
          <p className="mt-1.5 text-[1.0625rem] text-ink-subtle">Di luar jalur. XP tetap dihitung, streak tetap jalan.</p>
        </div>

        <div className="rise flex flex-wrap items-center gap-3.5 rounded-[22px] border-2 border-hairline bg-surface px-5 py-[18px] [--i:1]">
          <span className="w-[70px] text-[0.875rem] font-extrabold text-ink-subtle">Skill</span>
          <div role="radiogroup" aria-label="Filter skill" className="flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={skill === s.id}
                onClick={() => setSkill(s.id)}
                className={cn(
                  "min-h-11 cursor-pointer rounded-full border-2 px-4 text-[0.9375rem] font-extrabold transition-[transform,box-shadow] active:translate-y-0.5",
                  skill === s.id ? "border-primary bg-primary text-white" : "border-hairline bg-surface text-ink-muted",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <p aria-live="polite" className="text-[0.9375rem] font-bold text-ink-subtle">
          {modes.length} mode latihan cocok dengan filtermu
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modes.map((m, i) => (
            <Link
              key={m.title}
              href={m.href}
              className="pop clay-hover relative flex min-h-[210px] flex-col gap-2.5 overflow-hidden rounded-[24px] border-2 border-hairline bg-surface p-5 text-ink shadow-[0_5px_0_var(--color-hairline)]"
              style={{ "--i": i } as React.CSSProperties}
            >
              <span aria-hidden className={cn("absolute -right-7 -top-7 size-[120px] rounded-full opacity-70", m.tone.split(" ")[0])} />
              <span className={cn("relative grid size-[58px] place-items-center rounded-[18px] shadow-[0_4px_0_var(--l)]", m.tone)}>
                <m.Icon className="size-7" aria-hidden />
              </span>
              <span className="relative font-display text-[1.3125rem] font-black">{m.title}</span>
              <span className="relative flex-1 text-[0.9375rem] leading-snug text-ink-subtle">{m.desc}</span>
              <span className="relative flex flex-wrap gap-1.5">
                <span className="rounded-[8px] bg-canvas px-2.5 py-1 text-[0.8125rem] font-extrabold text-ink-subtle">{m.skill}</span>
                <span className="rounded-[8px] bg-canvas px-2.5 py-1 text-[0.8125rem] font-extrabold text-ink-subtle">{m.xp}</span>
                {m.isNew ? <span className="rounded-[8px] bg-brick px-2.5 py-1 text-[0.8125rem] font-extrabold text-white">BARU</span> : null}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <aside aria-label="Rekomendasi" className="flex w-full flex-col gap-4 lg:w-[340px] lg:shrink-0">
        <div className="rise relative overflow-hidden rounded-[26px] bg-primary p-[22px] text-white shadow-[0_6px_0_var(--color-primary-deep)] [--i:2]">
          <p className="text-[0.8125rem] font-extrabold tracking-[0.08em] text-[#cfebda]">REKOMENDASI LORI</p>
          <h2 className="mt-1.5 font-display text-[1.625rem] font-black leading-tight">
            {dueCount + openMistakes > 0 ? "Mulai dari yang paling butuh perhatian" : "Sesi campur untuk menjaga ritme"}
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-[0.9375rem] text-primary-soft">
            {recommendations.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="flex min-h-9 items-center underline-offset-2 hover:underline">
                  • {r.text}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={recommendations[0]?.href ?? "/latihan/soal"}
            className="mt-3 inline-flex min-h-[52px] items-center rounded-[16px] bg-white px-[22px] font-display text-[1.0625rem] font-black text-primary-deep shadow-[0_4px_0_var(--color-primary-soft)] transition-[transform,box-shadow] active:translate-y-1 active:shadow-none"
          >
            MULAI SEKARANG
          </Link>
        </div>

        <Link
          href="/latihan/kesalahan"
          className="rise ledge flex flex-col gap-2.5 rounded-[24px] border-2 border-[#efb4a2] bg-surface p-5 text-ink [--i:3] [--ledge:#efb4a2]"
        >
          <span className="font-display text-[1.25rem] font-black">Bank Kesalahan</span>
          <span className="text-[0.875rem] text-ink-subtle">
            {openMistakes > 0 ? `${openMistakes} kesalahan belum ditebus` : "Belum ada kesalahan yang menunggu"}
          </span>
          {topPattern ? (
            <span className="text-[0.875rem] text-ink-muted">
              Pola terbanyak: {topPattern.title} ({topPattern.open}×)
            </span>
          ) : null}
        </Link>

        <div className="rise rounded-[24px] border-2 border-hairline bg-surface p-5 [--i:4]">
          <h2 className="mb-3 font-display text-[1.125rem] font-black">Baru saja kamu kerjakan</h2>
          {recent.length === 0 ? (
            <p className="text-[0.9375rem] text-ink-subtle">Belum ada aktivitas. Pilih satu mode di kiri.</p>
          ) : (
            <ul className="flex flex-col gap-2.5 text-[0.9375rem] font-bold">
              {recent.map((r) => (
                <li key={r.id}>{r.detail}</li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
