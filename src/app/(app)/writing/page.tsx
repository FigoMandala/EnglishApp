import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { listWritingScores, listWritingSubmissions, listWrittenPrompts } from "@/db/queries/writing";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { ASPECT_LABEL, ESSAY_MAX_WORDS, ESSAY_MIN_WORDS } from "@/lib/writing";
import { promptOfTheDay } from "@/lib/writing-prompts";

import { EssayForm } from "./essay-form";
import { EssayHistory } from "./essay-history";
import { TopicStats } from "./topic-stats";

export const metadata = { title: "Writing Coach · EnglishApp" };

export default async function WritingPage() {
  const user = await requireUser();
  const [submissions, usedPrompts, scores] = await Promise.all([
    listWritingSubmissions(user.id, 12),
    listWrittenPrompts(user.id),
    listWritingScores(user.id),
  ]);
  const scored = submissions.filter((row) => row.total > 0);
  const avg = scored.length
    ? Math.round(scored.reduce((sum, row) => sum + row.total, 0) / scored.length)
    : null;
  const best = scored.reduce((max, row) => Math.max(max, row.total), 0);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow text-ink-subtle">Writing Coach</p>
          <h1 className="font-display text-[2.25rem] font-black leading-[1.1] tracking-[-0.02em]">
            Tulis, dinilai, lalu dibedah
          </h1>
          <p className="text-ink-subtle">
            Esai {ESSAY_MIN_WORDS}–{ESSAY_MAX_WORDS} kata. Skor 0–100 dari 4 aspek, plus sorotan koreksi di kalimatmu.
          </p>
        </div>
        <Link href="/writing/kilat" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Paragraf kilat
        </Link>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <EssayForm daily={promptOfTheDay(user.id, todayISO())} usedPrompts={usedPrompts} />

        <aside className="flex min-w-[280px] flex-[0_1_340px] flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] border-2 border-hairline bg-surface p-4">
              <span className="tnum block font-round text-[2.125rem] font-extrabold leading-none">{avg ?? "–"}</span>
              <span className="text-[0.8125rem] text-ink-subtle">rata-rata skor</span>
            </div>
            <div className="rounded-[20px] border-2 border-hairline bg-surface p-4">
              <span className="tnum block font-round text-[2.125rem] font-extrabold leading-none text-primary">
                {scored.length ? best : "–"}
              </span>
              <span className="text-[0.8125rem] text-ink-subtle">skor terbaik</span>
            </div>
          </div>

          <TopicStats rows={scores} />

          <div className="flex flex-col gap-1 rounded-[22px] border-2 border-hairline bg-surface p-5">
            <h2 className="eyebrow pb-1.5 text-ink-subtle">Riwayat esai</h2>
            {submissions.length === 0 ? (
              <p className="text-[0.875rem] text-ink-subtle">Belum ada esai. Mulai dari form di samping.</p>
            ) : (
              <EssayHistory
                rows={submissions.map((row) => ({
                  id: row.id,
                  prompt: row.prompt,
                  createdAt: row.createdAt,
                  wordCount: row.wordCount,
                  total: row.total,
                }))}
              />
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-[22px] border-2 border-dashed border-hairline-strong bg-surface-muted p-5">
            <h2 className="eyebrow text-ink-subtle">Aspek penilaian</h2>
            {Object.entries(ASPECT_LABEL).map(([key, label]) => (
              <span key={key} className="flex justify-between text-[0.875rem]">
                <span>{label}</span>
                <strong>25</strong>
              </span>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
