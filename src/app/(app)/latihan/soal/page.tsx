import { ChevronRight, GraduationCap } from "lucide-react";
import Link from "next/link";

import { ExerciseRunner } from "@/app/(app)/materi/[slug]/exercise-runner";
import {
  pickPracticeExercises,
  type PracticeLevel,
} from "@/db/queries/grammar-exercises";
import { requireUser } from "@/lib/session";

import { DrillToolbar } from "./drill-toolbar";

export const metadata = { title: "Soal Latihan · EnglishApp" };

const LEVELS: PracticeLevel[] = ["basic", "intermediate", "advanced"];
const LIMIT = 12;

const LEVEL_NOTE: Record<"all" | PracticeLevel, string> = {
  all: "campuran dari semua tingkat, dasar sampai lanjut",
  basic: "tingkat dasar: tenses sederhana, to be, dan pola kalimat awal",
  intermediate: "tingkat menengah: perfect tense, passive, dan konektor",
  advanced: "tingkat lanjut: conditional, inversi, dan struktur kompleks",
};

function parseLevel(value: string | undefined): PracticeLevel | undefined {
  return LEVELS.find((level) => level === value);
}

export default async function LatihanPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; n?: string; j?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const level = parseLevel(params.t);
  const choiceOnly = params.j === "pilgan";

  const exercises = await pickPracticeExercises(user.id, { level, limit: LIMIT, choiceOnly });
  const answeredCorrect = exercises.filter((exercise) => exercise.answered?.correct).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <nav aria-label="Remah roti" className="mb-2 flex items-center gap-2 text-[0.875rem] font-bold text-ink-subtle">
          <Link href="/latihan" className="text-ink-muted hover:text-primary-deep hover:underline">
            Latihan Bebas
          </Link>
          <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
          <span aria-current="page">Susun kalimat &amp; soal</span>
        </nav>
        <h1 className="font-display text-[2rem] font-black leading-[1.1] tracking-[-0.02em] sm:text-[2.25rem]">
          Asah grammar lintas materi
        </h1>
        <p className="max-w-2xl text-ink-subtle">
          {LIMIT} soal acak {LEVEL_NOTE[level ?? "all"]}. Semua dinilai otomatis dan langsung,
          tanpa perlu membuka satu materi. Tekan &ldquo;Ganti soal&rdquo; untuk set baru.
        </p>
      </header>

      <DrillToolbar level={level ?? "all"} choiceOnly={choiceOnly} />

      <div key={params.n ?? "default"} className="flex flex-col gap-4">
        {exercises.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-plate border-2 border-hairline bg-surface p-6 shadow-card">
            <GraduationCap className="size-6 text-primary" aria-hidden />
            <p className="text-[0.9375rem] text-ink-subtle">
              Belum ada soal untuk tingkat ini. Jalankan{" "}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">
                npm run db:seed
              </code>{" "}
              untuk mengisi bank soal.
            </p>
          </div>
        ) : (
          <>
            {answeredCorrect > 0 ? (
              <p className="text-[0.875rem] font-semibold text-ink-subtle">
                {answeredCorrect} dari {exercises.length} soal ini pernah kamu jawab benar.
              </p>
            ) : null}
            <ExerciseRunner lessonId={null} exercises={exercises} />
          </>
        )}
      </div>
    </div>
  );
}
