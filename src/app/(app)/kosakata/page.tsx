import { GraduationCap, Search, SpellCheck } from "lucide-react";
import Link from "next/link";

import { SpeakButton } from "@/components/speak-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { cachedVocabulary } from "@/db/queries/cached";
import { dueForecast, vocabularyStats } from "@/db/queries/vocabulary";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { cn } from "@/lib/utils";

import { StartReviewButton } from "./start-review";

export const metadata = { title: "Kosakata · EnglishApp" };

const LEVELS = ["semua", "basic", "intermediate", "advanced"] as const;
const LEVEL_LABEL = { semua: "Semua", basic: "Dasar", intermediate: "Menengah", advanced: "Lanjut" } as const;

export default async function KosakataPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string; topic?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();

  const [stats, forecast, allWords] = await Promise.all([
    vocabularyStats(user.id),
    dueForecast(user.id, today, 7),
    cachedVocabulary(),
  ]);

  const level = LEVELS.includes(params.level as (typeof LEVELS)[number])
    ? (params.level as (typeof LEVELS)[number])
    : "semua";
  const needle = (params.q ?? "").trim().toLowerCase();
  const topic = (params.topic ?? "").trim().toLowerCase();

  const topics = [...new Set(allWords.map((word) => word.topic).filter(Boolean))] as string[];

  const matched = allWords
    .filter((word) => (level === "semua" ? true : word.level === level))
    .filter((word) => (topic ? (word.topic ?? "").toLowerCase() === topic : true))
    .filter((word) =>
      needle ? word.word.toLowerCase().includes(needle) || word.meaning.toLowerCase().includes(needle) : true,
    );
  const filtered = matched.slice(0, 60);

  const maxForecast = Math.max(1, ...forecast.map((day) => day.count));
  const levelLabel = (value: string) =>
    value === "basic" ? "Dasar" : value === "intermediate" ? "Menengah" : "Lanjut";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow text-ink-subtle">Kosakata</p>
          <h1 className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[2.5rem]">
            Flashcard dengan pengulangan pintar
          </h1>
          <p className="max-w-2xl text-[0.9375rem] text-ink-subtle">
            Kartu yang sulit muncul lebih sering, yang mudah jadi jarang. {stats.due} kartu jatuh tempo
            hari ini dari {stats.tracked} yang sedang dipelajari.
          </p>
        </div>
        <StartReviewButton dueCount={stats.due} />
      </header>

      <section aria-label="Statistik" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total kata" value={stats.total} hint="di bank kosakata" />
        <StatCard label="Dipelajari" value={stats.tracked} hint="sudah punya kartu" />
        <StatCard label="Jatuh tempo" value={stats.due} hint="hari ini" accent={stats.due > 0} />
        <StatCard label="Dikuasai" value={stats.mastered} hint="box 5 ke atas" />
      </section>

      <section aria-label="Perkiraan beban" className="clay p-5">
        <p className="mb-3 text-[0.875rem] font-bold text-ink">Perkiraan ulangan 7 hari ke depan</p>
        <div className="flex items-end gap-2" role="img" aria-label="Jumlah kartu jatuh tempo per hari">
          {forecast.map((day) => (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="tnum font-mono text-[0.625rem] text-ink-faint">
                {day.count > 0 ? day.count : ""}
              </span>
              <div
                className={cn("w-full rounded-t-[4px]", day.date === today ? "bg-primary" : "bg-primary-bright/60")}
                style={{ height: `${Math.max(3, (day.count / maxForecast) * 64)}px` }}
                title={`${day.date}: ${day.count} kartu`}
              />
              <span className="text-[0.625rem] font-semibold text-ink-subtle">{day.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="daftar-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="daftar-title" className="flex items-center gap-2.5 font-display text-[1.375rem] font-extrabold">
            <SpellCheck className="size-5 text-primary" aria-hidden />
            Jelajahi kosakata
          </h2>
          <form className="relative" action="/kosakata">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            {level !== "semua" ? <input type="hidden" name="level" value={level} /> : null}
            {topic ? <input type="hidden" name="topic" value={topic} /> : null}
            <Input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Cari kata atau arti…"
              className="h-10 w-56 pl-9 text-[0.875rem]"
              aria-label="Cari kosakata"
            />
          </form>
        </div>

        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter level">
          {LEVELS.map((value) => (
            <Link
              key={value}
              href={`/kosakata${value === "semua" ? "" : `?level=${value}`}${params.q ? `${value === "semua" ? "?" : "&"}q=${encodeURIComponent(params.q)}` : ""}`}
              role="radio"
              aria-checked={level === value}
              className={cn(
                "min-h-9 rounded-control border-2 px-3.5 py-1.5 text-[0.8125rem] font-bold transition-colors",
                level === value
                  ? "border-primary bg-primary-soft text-primary-deep"
                  : "border-hairline bg-surface text-ink-subtle hover:border-primary",
              )}
            >
              {LEVEL_LABEL[value]}
            </Link>
          ))}
        </div>

        {topics.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter topik">
            <Link
              href={`/kosakata${level !== "semua" ? `?level=${level}` : ""}${params.q ? `${level !== "semua" ? "&" : "?"}q=${encodeURIComponent(params.q)}` : ""}`}
              role="radio"
              aria-checked={!topic}
              className={cn(
                "min-h-8 rounded-full border-2 px-3 py-1 text-[0.75rem] font-bold transition-colors",
                !topic
                  ? "border-primary bg-primary-soft text-primary-deep"
                  : "border-hairline bg-surface text-ink-subtle hover:border-primary",
              )}
            >
              Semua topik
            </Link>
            {topics.slice(0, 11).map((value) => {
              const active = topic === value.toLowerCase();
              const query = new URLSearchParams();
              if (level !== "semua") query.set("level", level);
              if (params.q) query.set("q", params.q);
              if (!active) query.set("topic", value);
              const qs = query.toString();
              return (
                <Link
                  key={value}
                  href={`/kosakata${qs ? `?${qs}` : ""}`}
                  role="radio"
                  aria-checked={active}
                  className={cn(
                    "min-h-8 rounded-full border-2 px-3 py-1 text-[0.75rem] font-bold transition-colors",
                    active
                      ? "border-primary bg-primary-soft text-primary-deep"
                      : "border-hairline bg-surface text-ink-subtle hover:border-primary",
                  )}
                >
                  {value}
                </Link>
              );
            })}
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <Card className="p-6">
            <p className="text-[0.9375rem] text-ink-subtle">
              Tidak ada kata yang cocok. Bank kosakata bisa ditambah lewat{" "}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">npm run db:vocab</code>.
            </p>
          </Card>
        ) : (
          <>
            {matched.length > filtered.length ? (
              <p className="text-[0.8125rem] text-ink-faint">
                Menampilkan {filtered.length} dari {matched.length} kata yang cocok. Persemp filter untuk melihat lainnya.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((word) => (
              <Card key={word.id} className="flex flex-col gap-2 p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2 font-display text-[1.125rem] font-extrabold text-ink">
                    <span className="truncate">{word.word}</span>
                    <SpeakButton text={word.word} label={`Dengarkan ${word.word}`} className="size-8" />
                  </p>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[0.6875rem] font-bold text-ink-subtle">
                    {levelLabel(word.level)}
                  </span>
                </div>
                <p className="text-[0.9375rem] text-ink-muted">{word.meaning}</p>
                {word.phonetic ? <p className="font-mono text-[0.75rem] text-ink-faint">{word.phonetic}</p> : null}
                {word.exampleEn ? (
                  <p className="mt-1 border-l-2 border-hairline pl-3 text-[0.8125rem] italic leading-snug text-ink-subtle">
                    {word.exampleEn}
                    {word.exampleId ? (
                      <span className="mt-0.5 block not-italic text-ink-faint">{word.exampleId}</span>
                    ) : null}
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-[0.75rem] font-semibold text-ink-faint">
                    {word.topic ?? "umum"}
                  </span>
                  <GraduationCap className="size-4 text-ink-faint" aria-hidden />
                </div>
              </Card>
            ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-1.5 p-4 sm:p-5">
      <span className="text-[0.875rem] font-bold text-ink-subtle">{label}</span>
      <span
        className={cn(
          "tnum font-round text-[2rem] font-extrabold leading-none",
          accent ? "text-warning" : "text-primary",
        )}
      >
        {value}
      </span>
      <span className="text-[0.8125rem] text-ink-subtle">{hint}</span>
    </Card>
  );
}
