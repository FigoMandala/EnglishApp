import { ArrowLeft, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getWritingSubmission } from "@/db/queries/writing";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { ASPECT_LABEL, ASPECT_HINT, parseStoredScore, type WritingAspect } from "@/lib/writing";
import { cn } from "@/lib/utils";

export const metadata = { title: "Hasil Esai · Writing Coach" };

export default async function EssayResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const submission = await getWritingSubmission(user.id, numericId);
  if (!submission) notFound();

  const score = parseStoredScore(submission.feedback);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/writing"
          className="flex items-center gap-1.5 text-[0.875rem] font-bold text-ink-subtle transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Writing Coach
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em]">
              {submission.prompt || "Esai tanpa topik"}
            </h1>
            <p className="text-[0.875rem] text-ink-subtle">
              {formatDate(submission.createdAt)} · {submission.wordCount} kata
            </p>
          </div>
          <ScoreDial total={submission.total} />
        </div>
      </div>

      {score ? (
        <>
          <section aria-labelledby="aspek-title" className="flex flex-col gap-3">
            <h2 id="aspek-title" className="font-display text-[1.375rem] font-extrabold">
              Nilai per aspek
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {score.aspects.map((aspect) => (
                <Card key={aspect.aspect} className="flex flex-col gap-2 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-[1.0625rem] font-extrabold text-ink">
                        {ASPECT_LABEL[aspect.aspect as WritingAspect] ?? aspect.aspect}
                      </p>
                      <p className="text-[0.75rem] text-ink-faint">
                        {ASPECT_HINT[aspect.aspect as WritingAspect]}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "tnum font-round text-[1.75rem] font-extrabold leading-none",
                        aspect.score >= 70 ? "text-primary" : aspect.score >= 50 ? "text-warning" : "text-negative",
                      )}
                    >
                      {aspect.score}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-canvas-deep">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        aspect.score >= 70 ? "bg-primary" : aspect.score >= 50 ? "bg-warning" : "bg-negative",
                      )}
                      style={{ width: `${aspect.score}%` }}
                    />
                  </div>
                  {aspect.note ? <p className="text-[0.875rem] leading-snug text-ink-subtle">{aspect.note}</p> : null}
                </Card>
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {score.strengths.length ? (
              <Card className="flex flex-col gap-2 p-5">
                <h2 className="flex items-center gap-2 font-display text-[1.125rem] font-extrabold">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden />
                  Kekuatan
                </h2>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.875rem] leading-snug text-ink-muted">
                  {score.strengths.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </Card>
            ) : null}
            {score.improvements.length ? (
              <Card className="flex flex-col gap-2 p-5">
                <h2 className="flex items-center gap-2 font-display text-[1.125rem] font-extrabold">
                  <Lightbulb className="size-4 text-warning" aria-hidden />
                  Saran perbaikan
                </h2>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.875rem] leading-snug text-ink-muted">
                  {score.improvements.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>

          {score.summary ? (
            <Card className="flex flex-col gap-1.5 border-primary/40 bg-primary-soft/50 p-5">
              <h2 className="flex items-center gap-2 font-display text-[1.125rem] font-extrabold">
                <Sparkles className="size-4 text-primary" aria-hidden />
                Ringkasan penilai
              </h2>
              <p className="text-[0.9375rem] leading-relaxed text-ink-muted">{score.summary}</p>
            </Card>
          ) : null}

          {score.corrections.length ? (
            <section aria-labelledby="koreksi-title" className="flex flex-col gap-3">
              <h2 id="koreksi-title" className="font-display text-[1.375rem] font-extrabold">
                Koreksi kalimat ({score.corrections.length})
              </h2>
              <ol className="flex flex-col gap-3">
                {score.corrections.map((correction, index) => (
                  <li key={index} className="rounded-plate border-2 border-hairline bg-surface p-5 shadow-card">
                    <div className="flex flex-col gap-2">
                      <p className="text-[0.9375rem] leading-relaxed text-negative line-through decoration-negative/40">
                        {correction.original}
                      </p>
                      <p className="text-[0.9375rem] font-semibold leading-relaxed text-primary-deep">
                        {correction.correction}
                      </p>
                      <p className="rounded-control bg-surface-muted px-3 py-2 text-[0.8125rem] leading-snug text-ink-subtle">
                        {correction.reason}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : (
        <Card className="p-6">
          <p className="text-[0.9375rem] text-ink-subtle">Hasil penilaian tidak bisa dibaca.</p>
        </Card>
      )}

      <section aria-labelledby="esai-title" className="flex flex-col gap-3">
        <h2 id="esai-title" className="font-display text-[1.375rem] font-extrabold">
          Teks esai
        </h2>
        <Card className="whitespace-pre-wrap p-6 text-[0.9375rem] leading-relaxed text-ink-muted">
          {submission.essay}
        </Card>
      </section>
    </div>
  );
}

function ScoreDial({ total }: { total: number }) {
  const tone = total >= 70 ? "text-primary" : total >= 50 ? "text-warning" : "text-negative";
  const bar = total >= 70 ? "bg-primary" : total >= 50 ? "bg-warning" : "bg-negative";
  return (
    <div className="flex items-center gap-4 rounded-plate border-2 border-hairline bg-surface p-4 shadow-card">
      <div className="flex flex-col items-center">
        <span className={cn("tnum font-round text-[2.5rem] font-extrabold leading-none", tone)}>{total}</span>
        <span className="text-[0.75rem] font-semibold text-ink-subtle">skor total</span>
      </div>
      <div className="h-16 w-2 overflow-hidden rounded-full bg-canvas-deep">
        <div className={cn("mt-auto h-full origin-bottom rounded-full", bar)} style={{ transform: `scaleY(${total / 100})`, marginTop: `${100 - total}%` }} />
      </div>
    </div>
  );
}
