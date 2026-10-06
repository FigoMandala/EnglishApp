import { BookOpen, History, PenLine, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { listWritingSubmissions } from "@/db/queries/writing";
import { requireUser } from "@/lib/session";
import { ASPECT_LABEL } from "@/lib/writing";

import { EssayForm } from "./essay-form";
import { EssayHistory } from "./essay-history";

export const metadata = { title: "Writing Coach · EnglishApp" };

export default async function WritingPage() {
  const user = await requireUser();
  const submissions = await listWritingSubmissions(user.id, 12);
  const scored = submissions.filter((row) => row.total > 0);
  const avg = scored.length
    ? Math.round(scored.reduce((sum, row) => sum + row.total, 0) / scored.length)
    : null;
  const best = scored.reduce((max, row) => Math.max(max, row.total), 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <p className="eyebrow text-ink-subtle">Writing Coach</p>
        <h1 className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[2.5rem]">
          Tulis esai, dapatkan koreksi mendetail
        </h1>
        <p className="max-w-2xl text-[0.9375rem] text-ink-subtle">
          AI menilai 4 aspek: isi, struktur, grammar, dan kosakata. Setiap kalimat bermasalah diberi
          perbaikan beserta alasannya dalam Bahasa Indonesia.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <EssayForm />

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 font-display text-[1.125rem] font-extrabold">
              <TrendingUp className="size-4 text-primary" aria-hidden />
              Statistik menulis
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="tnum font-round text-[1.75rem] font-extrabold leading-none text-primary">
                  {avg ?? "–"}
                </span>
                <span className="text-[0.75rem] text-ink-subtle">rata-rata skor</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="tnum font-round text-[1.75rem] font-extrabold leading-none text-primary">
                  {scored.length ? best : "–"}
                </span>
                <span className="text-[0.75rem] text-ink-subtle">skor terbaik</span>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 font-display text-[1.125rem] font-extrabold">
              <History className="size-4 text-primary" aria-hidden />
              Riwayat esai
            </h2>
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
          </Card>

          <Card className="flex flex-col gap-2 p-5">
            <h2 className="flex items-center gap-2 font-display text-[1.125rem] font-extrabold">
              <BookOpen className="size-4 text-primary" aria-hidden />
              Aspek penilaian
            </h2>
            <ul className="flex flex-col gap-1.5 text-[0.8125rem] text-ink-subtle">
              {Object.entries(ASPECT_LABEL).map(([key, label]) => (
                <li key={key} className="flex items-center gap-2">
                  <PenLine className="size-3 shrink-0 text-primary" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
