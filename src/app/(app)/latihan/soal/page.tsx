import { GraduationCap } from "lucide-react";

import { ExerciseRunner } from "@/app/(app)/materi/[slug]/exercise-runner";
import {
  pickPracticeExercises,
  type PracticeLevel,
} from "@/db/queries/grammar-exercises";
import { requireUser } from "@/lib/session";

import { DrillToolbar } from "./drill-toolbar";

export const metadata = { title: "Latihan Bebas · EnglishApp" };

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
  searchParams: Promise<{ t?: string; n?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const level = parseLevel(params.t);

  const exercises = await pickPracticeExercises(user.id, { level, limit: LIMIT });
  const answeredCorrect = exercises.filter((exercise) => exercise.answered?.correct).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <p className="eyebrow text-ink-subtle">Latihan Bebas</p>
        <h1 className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[2.5rem]">
          Asah grammar lintas materi
        </h1>
        <p className="max-w-2xl text-[0.9375rem] text-ink-subtle">
          {LIMIT} soal acak {LEVEL_NOTE[level ?? "all"]}. Semua dinilai otomatis dan langsung,
          tanpa perlu membuka satu materi. Tekan &ldquo;Ganti soal&rdquo; untuk set baru.
        </p>
      </header>

      <DrillToolbar level={level ?? "all"} />

      <div key={params.n ?? "default"} className="flex flex-col gap-4">
        {exercises.length === 0 ? (
          <div className="clay flex flex-col items-start gap-2 p-6">
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
