import { BookOpen, Check, Search } from "lucide-react";
import Link from "next/link";

import { LevelTag } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listGrammarLessons } from "@/db/queries/grammar";
import { exerciseStatsByLesson } from "@/db/queries/grammar-exercises";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Materi Grammar · EnglishApp" };

const LEVELS = [
  { key: "basic", label: "Dasar", tag: "DASAR", heading: "Fondasi kalimat" },
  { key: "intermediate", label: "Menengah", tag: "MENENGAH", heading: "Pola EPrT paling sering" },
  { key: "advanced", label: "Lanjut", tag: "LANJUT", heading: "Struktur kompleks" },
] as const;

type LevelKey = (typeof LEVELS)[number]["key"];

function masteryTone(pct: number) {
  if (pct >= 75) return { bar: "bg-primary", text: "text-primary-deep" };
  if (pct >= 50) return { bar: "bg-mango", text: "text-mango-ink" };
  return { bar: "bg-brick", text: "text-brick-deep" };
}

export default async function MateriPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const [lessons, stats] = await Promise.all([listGrammarLessons(user.id), exerciseStatsByLesson(user.id)]);

  const q = (params.q ?? "").trim().toLowerCase();
  const level = LEVELS.some((l) => l.key === params.level) ? (params.level as LevelKey) : null;
  const visible = lessons.filter(
    (lesson) =>
      (!level || lesson.level === level) &&
      (!q || lesson.title.toLowerCase().includes(q) || (lesson.summary ?? "").toLowerCase().includes(q)),
  );

  const done = lessons.filter((lesson) => lesson.completed).length;
  const masteries = lessons
    .map((lesson) => stats.get(lesson.slug))
    .filter((stat): stat is NonNullable<typeof stat> => Boolean(stat && stat.total > 0))
    .map((stat) => stat.correct / stat.total);
  const avgMastery = masteries.length ? Math.round((masteries.reduce((a, b) => a + b, 0) / masteries.length) * 100) : null;
  const next = lessons.find((lesson) => !lesson.completed) ?? null;

  const levelHref = (key: LevelKey | null) => {
    const sp = new URLSearchParams();
    if (key) sp.set("level", key);
    if (params.q) sp.set("q", params.q);
    const qs = sp.toString();
    return `/materi${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow text-ink-subtle">Perpustakaan grammar</p>
          <h1 className="font-display text-[2rem] font-black leading-[1.1] tracking-[-0.02em] sm:text-[2.25rem]">Materi Grammar</h1>
          <p className="text-ink-subtle">
            {lessons.length} topik · {done} selesai
            {avgMastery !== null ? ` · rata-rata penguasaan ${avgMastery}%` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form action="/materi" role="search" className="relative w-[300px] max-w-full">
            {level ? <input type="hidden" name="level" value={level} /> : null}
            <label htmlFor="materi-q" className="sr-only">
              Cari materi
            </label>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-subtle" strokeWidth={2.4} aria-hidden />
            <input
              id="materi-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Cari materi, mis. passive"
              className="h-12 w-full rounded-full border-2 border-hairline bg-surface pl-11 pr-4 text-[0.9375rem] focus:border-primary focus:outline-none"
            />
          </form>
          <nav aria-label="Filter level" className="flex gap-1 rounded-control bg-canvas-deep p-1">
            {[{ key: null, label: "Semua" } as const, ...LEVELS].map((item) => {
              const active = level === item.key;
              return (
                <Link
                  key={item.label}
                  href={levelHref(item.key)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex h-10 items-center rounded-[10px] px-3.5 text-[0.875rem] transition-colors",
                    active ? "bg-surface font-extrabold shadow-[0_2px_0_var(--color-hairline-strong)]" : "font-bold text-ink-muted hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {next && !q && !level ? (
        <Link
          href={`/materi/${next.slug}`}
          className="flex flex-wrap items-center gap-5 rounded-[24px] border-2 border-primary-line bg-surface px-6 py-5 shadow-[0_4px_0_var(--color-primary-line)] transition-transform active:translate-y-1 active:shadow-none"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-[16px] bg-primary-soft text-primary">
            <BookOpen className="size-[26px]" strokeWidth={2.2} aria-hidden />
          </span>
          <span className="min-w-0 flex-[1_1_260px]">
            <span className="eyebrow block text-primary-deep">Lanjutkan · materi berikutnya</span>
            <strong className="block font-display text-[1.25rem]">{next.title}</strong>
            {next.summary ? <span className="line-clamp-1 text-[0.875rem] text-ink-subtle">{next.summary}</span> : null}
          </span>
          <span className="flex h-12 items-center rounded-[14px] bg-primary px-5 font-display text-[0.9375rem] font-extrabold tracking-[0.03em] text-white shadow-[0_4px_0_var(--color-primary-deep)]">
            BUKA
          </span>
        </Link>
      ) : null}

      {lessons.length === 0 ? (
        <Card className="p-6">
          <p className="text-[0.9375rem] text-ink-subtle">
            Materi belum diisi. Jalankan <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">npm run db:seed</code>.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-6 text-[0.9375rem] text-ink-subtle">Tidak ada yang cocok. Coba kata lain.</Card>
      ) : (
        LEVELS.map((lv) => {
          const items = visible.filter((lesson) => lesson.level === lv.key);
          if (!items.length) return null;
          const all = lessons.filter((lesson) => lesson.level === lv.key);
          return (
            <section key={lv.key} aria-labelledby={`level-${lv.key}`} className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <LevelTag level={lv.tag} />
                <h2 id={`level-${lv.key}`} className="font-display text-[1.25rem] font-extrabold">
                  {lv.heading}
                </h2>
                <span className="text-[0.8125rem] text-ink-subtle">
                  {all.filter((lesson) => lesson.completed).length}/{all.length} selesai
                </span>
              </div>
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
                {items.map((lesson) => {
                  const stat = stats.get(lesson.slug);
                  const pct = stat && stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : null;
                  const tone = pct !== null ? masteryTone(pct) : null;
                  return (
                    <Link
                      key={lesson.id}
                      href={`/materi/${lesson.slug}`}
                      className="flex flex-col gap-2.5 rounded-plate border-2 border-hairline bg-surface p-[18px] shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                    >
                      <span className="flex items-center justify-between">
                        {lesson.completed ? (
                          <span className="grid size-7 place-items-center rounded-full bg-primary text-white">
                            <Check className="size-3.5" strokeWidth={3.4} aria-label="Selesai" />
                          </span>
                        ) : (
                          <span aria-hidden className="size-7 rounded-full border-2 border-hairline-strong" />
                        )}
                        <span className={cn("text-[0.8125rem] font-extrabold", tone?.text ?? "text-ink-subtle")}>
                          {pct !== null ? `${pct}%` : "BELUM DILATIH"}
                        </span>
                      </span>
                      <strong className="text-[1rem] leading-snug">{lesson.title}</strong>
                      {lesson.summary ? (
                        <span className="line-clamp-2 text-[0.8125rem] leading-snug text-ink-subtle">{lesson.summary}</span>
                      ) : null}
                      <span className="mt-auto h-1.5 overflow-hidden rounded-full bg-canvas-deep">
                        {pct !== null ? <span className={cn("block h-full", tone?.bar)} style={{ width: `${pct}%` }} /> : null}
                      </span>
                      <span className="text-[0.75rem] font-bold text-ink-subtle">
                        {stat && stat.total > 0 ? `${stat.correct}/${stat.total} latihan benar` : "belum ada latihan"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
