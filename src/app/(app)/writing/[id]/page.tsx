import { CheckCircle2, ChevronRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getWritingSubmission } from "@/db/queries/writing";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { ASPECT_LABEL, ASPECT_HINT, parseStoredScore, type WritingAspect } from "@/lib/writing";
import { cn } from "@/lib/utils";

import { EssayReview } from "./essay-review";

export const metadata = { title: "Hasil Esai · EnglishApp" };

export default async function EssayResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const submission = await getWritingSubmission(user.id, numericId);
  if (!submission) notFound();

  const score = parseStoredScore(submission.feedback);

  const title = submission.prompt || "Esai tanpa topik";

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      <nav aria-label="Remah roti" className="flex items-center gap-2 text-[0.875rem] font-bold text-ink-subtle">
        <Link href="/writing" className="text-ink-muted hover:text-primary">
          Writing Coach
        </Link>
        <ChevronRight className="size-3.5" strokeWidth={2.6} aria-hidden />
        <span aria-current="page" className="truncate">
          {title}
        </span>
      </nav>

      {score ? (
        <>
          <EssayReview
            title={title}
            meta={`${formatDate(submission.createdAt)} · ${submission.wordCount} kata · dinilai Lori`}
            summary={score.summary || null}
            essay={submission.essay}
            corrections={score.corrections}
            total={submission.total}
            aspects={score.aspects.map((aspect) => ({
              label: ASPECT_LABEL[aspect.aspect as WritingAspect] ?? aspect.aspect,
              score: aspect.score,
            }))}
          />

          {score.aspects.some((aspect) => aspect.note) ? (
            <section aria-labelledby="aspek-title" className="flex flex-col gap-3">
              <h2 id="aspek-title" className="font-display text-[1.25rem] font-extrabold">
                Catatan per aspek
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {score.aspects.map((aspect) => (
                  <div key={aspect.aspect} className="flex flex-col gap-1 rounded-[20px] border-2 border-hairline bg-surface p-5">
                    <p className="flex items-baseline justify-between gap-3 font-display text-[1.0625rem] font-extrabold">
                      {ASPECT_LABEL[aspect.aspect as WritingAspect] ?? aspect.aspect}
                      <span
                        className={cn(
                          "tnum font-round",
                          aspect.score >= 70 ? "text-primary-deep" : aspect.score >= 50 ? "text-mango-ink" : "text-brick-deep",
                        )}
                      >
                        {aspect.score}
                      </span>
                    </p>
                    <p className="text-[0.75rem] text-ink-subtle">{ASPECT_HINT[aspect.aspect as WritingAspect]}</p>
                    {aspect.note ? <p className="mt-1 text-[0.875rem] leading-snug text-ink-muted">{aspect.note}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {score.strengths.length ? (
              <div className="flex flex-col gap-2 rounded-[20px] border-2 border-primary-line bg-primary-soft p-5">
                <h2 className="flex items-center gap-2 font-display text-[1.125rem] font-extrabold text-primary-deep">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Kekuatan
                </h2>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.9375rem] leading-snug text-ink-muted">
                  {score.strengths.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {score.improvements.length ? (
              <div className="flex flex-col gap-2 rounded-[20px] border-2 border-mango-line bg-mango-soft p-5">
                <h2 className="flex items-center gap-2 font-display text-[1.125rem] font-extrabold text-mango-ink">
                  <Lightbulb className="size-4" aria-hidden />
                  Saran perbaikan
                </h2>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.9375rem] leading-snug text-ink-muted">
                  {score.improvements.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="rounded-[20px] border-2 border-hairline bg-surface p-6">
          <h1 className="font-display text-[1.5rem] font-extrabold">{title}</h1>
          <p className="text-[0.9375rem] text-ink-subtle">Hasil penilaian tidak bisa dibaca.</p>
        </div>
      )}
    </div>
  );
}
