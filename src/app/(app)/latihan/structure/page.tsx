import { BookOpen } from "lucide-react";
import Link from "next/link";

import { requireUser } from "@/lib/session";
import { SKILLS, type SkillKey } from "@/lib/toefl";

import { TopicCard } from "./topic-card";

export const metadata = { title: "Latihan Structure · EnglishApp" };
// Soal dibuat AI di dalam server action halaman ini.
export const maxDuration = 300;

const TOPICS = (Object.keys(SKILLS) as SkillKey[]).filter((key) => SKILLS[key].section === "structure");

export default async function StructurePracticePage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow text-ink-subtle">Latihan khusus</p>
          <h1 className="font-display text-[2rem] font-black leading-[1.1] tracking-[-0.02em] sm:text-[2.25rem]">Latihan Structure</h1>
          <p className="max-w-[560px] text-ink-subtle">
            Pilih satu topik, lalu kerjakan sampai 10 soal gaya TOEFL ITP yang dibuat AI. Menyiapkannya bisa makan waktu sekitar satu menit. Tiap soal ada penjelasannya setelah dijawab.
          </p>
        </div>
        <Link
          href="/materi"
          className="flex h-11 items-center gap-2 rounded-[12px] border-2 border-hairline bg-surface px-4 text-[0.875rem] font-extrabold shadow-[0_3px_0_var(--color-hairline)]"
        >
          <BookOpen className="size-4" strokeWidth={2.4} aria-hidden />
          Baca materinya
        </Link>
      </header>

      <section aria-label="Topik Structure" className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
        {TOPICS.map((key) => (
          <TopicCard key={key} skill={key} label={SKILLS[key].label} hint={SKILLS[key].hint} />
        ))}
      </section>

      <p className="text-[0.8125rem] text-ink-subtle">
        <strong>Lengkapi kalimat</strong> = soal Structure (soal 1-15 di ujian). <strong>Cari kesalahan</strong> = Written Expression (soal 16-40).
      </p>
    </div>
  );
}
