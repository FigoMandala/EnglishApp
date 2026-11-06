import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { getBankItem } from "@/db/queries/admin";
import { getQuestionStats, type LevelBand } from "@/db/queries/question-bank";
import { judgeQuestion } from "@/lib/calibration";
import { fingerprint, questionText } from "@/lib/question-variety";
import { parseQuestions } from "@/lib/toefl";

import { Notice, param, type AdminSearchParams } from "../../notice";
import { BankItemForm } from "./bank-item-form";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminBankItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const row = await getBankItem(Number(id));
  if (!row) notFound();

  let passage: string | null = null;
  let rawCount = 0;
  let questions: ReturnType<typeof parseQuestions> = [];
  try {
    const stored = JSON.parse(row.item) as { passage?: unknown; questions?: unknown };
    passage = typeof stored.passage === "string" ? stored.passage : null;
    rawCount = Array.isArray(stored.questions) ? stored.questions.length : 0;
    questions = parseQuestions(JSON.stringify(stored.questions ?? []));
  } catch {
    // Ditangani di bawah: item rusak tidak bisa disunting.
  }
  const band = row.levelBand as LevelBand;
  const stats = await getQuestionStats(row.track, questions.map((q) => fingerprint(questionText(q))));
  const editable = questions.length > 0 && questions.length === rawCount;

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/admin/soal?track=${row.track}`} className="font-bold">← Bank Soal</Link>
      <PageHeader
        eyebrow={`${row.track.toUpperCase()} · ${row.kind}${row.skill ? ` · ${row.skill}` : ""}`}
        title={`Edit soal #${row.id}`}
        description="Mengubah teks, pilihan, atau kunci akan mereset statistik kalibrasi soal itu, karena jawaban lama dinilai dengan kunci lama."
      />
      <Notice pesan={param(query, "pesan")} galat={param(query, "galat")} />
      {editable ? (
        <BankItemForm
          id={row.id}
          levelBand={band}
          passage={passage}
          questions={questions.map((q) => {
            const stat = stats.get(fingerprint(questionText(q)));
            return {
              q: q.q,
              options: q.options,
              answer: q.answer,
              explain: q.explain_id,
              audio: (q.audio ?? []).map((line) => `${line.speaker}: ${line.text}`),
              attempts: stat?.attempts ?? 0,
              correct: stat?.correct ?? 0,
              verdict: judgeQuestion(stat, band),
            };
          })}
        />
      ) : (
        <p role="alert" className="rounded-control border-2 border-brick/30 bg-brick-soft px-4 py-3 font-bold text-brick-deep">
          Item ini rusak atau formatnya tidak dikenali, jadi tidak bisa disunting. Tarik saja dari Bank Soal.
        </p>
      )}
    </div>
  );
}
