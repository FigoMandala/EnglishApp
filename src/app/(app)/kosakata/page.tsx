import { Search } from "lucide-react";
import Link from "next/link";

import { SpeakButton } from "@/components/speak-button";
import { LevelTag } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { dueForecast, listVocabularyPage, vocabularyStats } from "@/db/queries/vocabulary";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { cn } from "@/lib/utils";
import { wordStatus } from "@/lib/word-status";
import { XP_REWARDS } from "@/lib/xp";

import { StartReviewButton } from "./start-review";

export const metadata = { title: "Kosakata · EnglishApp" };

const LEVELS = ["semua", "basic", "intermediate", "advanced"] as const;
const LEVEL_LABEL = { semua: "Semua tingkat", basic: "Dasar", intermediate: "Menengah", advanced: "Lanjut" } as const;
const STATUSES = ["semua", "due", "new", "mastered"] as const;
const STATUS_LABEL = { semua: "Semua", due: "Jatuh tempo", new: "Baru", mastered: "Dikuasai" } as const;
const DAY = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MAX_ROWS = 60;

/** Bold kata target di kalimat contoh. */
function emphasize(sentence: string, word: string) {
  const at = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (at < 0) return sentence;
  return (
    <>
      {sentence.slice(0, at)}
      <strong className="text-ink">{sentence.slice(at, at + word.length)}</strong>
      {sentence.slice(at + word.length)}
    </>
  );
}

export default async function KosakataPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string; topic?: string; status?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();

  const level = LEVELS.includes(params.level as (typeof LEVELS)[number]) ? (params.level as (typeof LEVELS)[number]) : "semua";
  const status = STATUSES.includes(params.status as (typeof STATUSES)[number])
    ? (params.status as (typeof STATUSES)[number])
    : "semua";
  const needle = (params.q ?? "").trim().toLowerCase();
  const topic = (params.topic ?? "").trim().toLowerCase();
  // Ada filter (kata kunci/level/topik/status) aktif? Membedakan hasil kosong
  // karena filter vs bank kosakata yang benar-benar kosong.
  const hasFilter = level !== "semua" || status !== "semua" || needle !== "" || topic !== "";

  // Filter didorong ke SQL; hanya 60 baris pertama yang pernah keluar dari DB.
  const [stats, forecast, list] = await Promise.all([
    vocabularyStats(user.id),
    dueForecast(user.id, today, 7),
    listVocabularyPage(user.id, {
      level: level === "semua" ? undefined : level,
      topic: topic || undefined,
      q: needle || undefined,
      status: status === "semua" ? undefined : status,
      today,
      limit: MAX_ROWS,
    }),
  ]);

  const topics = list.topics;
  const rows = list.rows.map((card) => ({ card, status: wordStatus(card, today) }));
  const matchedCount = list.matchedCount;
  const newWaiting = list.newWaiting;

  const maxForecast = Math.max(1, ...forecast.map((day) => day.count));
  const recall = stats.tracked > 0 ? Math.round(((stats.tracked - stats.due) / stats.tracked) * 100) : null;

  const href = (patch: Partial<Record<"level" | "q" | "topic" | "status", string | null>>) => {
    const sp = new URLSearchParams();
    const next = { level: level === "semua" ? null : level, q: params.q ?? null, topic: topic || null, status: status === "semua" ? null : status, ...patch };
    for (const [key, value] of Object.entries(next)) if (value) sp.set(key, value);
    const qs = sp.toString();
    return `/kosakata${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <p className="eyebrow text-ink-subtle">Dek SRS-mu</p>
        <h1 className="font-display text-[2rem] font-black leading-[1.1] tracking-[-0.02em] sm:text-[2.25rem]">Kosakata</h1>
      </header>

      <div className="flex flex-wrap items-stretch gap-5">
        <div className="flex min-w-0 flex-[1_1_420px] flex-wrap items-center gap-5 rounded-hero border-2 border-mango-line bg-mango-soft p-6 text-mango-ink shadow-[0_5px_0_var(--color-mango-line)] sm:p-7">
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
            <span className="eyebrow">Ulang hari ini</span>
            <span className="flex flex-wrap items-baseline gap-2">
              <span className="font-round text-[4rem] font-extrabold leading-[0.9] text-ink">{stats.due}</span>
              <span className="font-display text-[1.25rem] font-extrabold text-ink">kartu jatuh tempo</span>
            </span>
            <span className="text-[0.9375rem]">
              ±{Math.max(1, Math.ceil((stats.due || 10) / 5))} menit
              {newWaiting > 0 ? ` · ${newWaiting} kata baru menunggu` : ""} · +{XP_REWARDS.vocabCard} XP per kartu
            </span>
          </div>
          <StartReviewButton dueCount={stats.due} newWaiting={newWaiting} />
        </div>

        <section aria-label="Prakiraan 7 hari" className="flex min-w-0 flex-[1_1_340px] flex-col gap-3 rounded-hero border-2 border-hairline bg-surface px-6 py-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[1.0625rem] font-extrabold">Prakiraan 7 hari</h2>
            <span className="text-[0.8125rem] text-ink-subtle">kartu/hari</span>
          </div>
          <div
            role="img"
            aria-label={`Jumlah kartu jatuh tempo: ${forecast.map((day) => `${day.date} ${day.count}`).join(", ")}`}
            className="grid h-[120px] grid-cols-7 items-end gap-2"
          >
            {forecast.map((day) => (
              <span key={day.date} className="flex h-full flex-col items-center justify-end gap-1 text-[0.75rem] font-extrabold">
                <span className={day.date === today ? "text-mango-ink" : "text-ink-subtle"}>{day.count}</span>
                <span
                  className={cn("w-full rounded-[8px_8px_4px_4px]", day.date === today ? "bg-mango" : "bg-canvas-deep")}
                  style={{ height: `${Math.max(4, (day.count / maxForecast) * 80)}px` }}
                />
              </span>
            ))}
          </div>
          <div aria-hidden className="grid grid-cols-7 gap-2 text-center text-[0.75rem] font-extrabold text-ink-subtle">
            {forecast.map((day) => (
              <span key={day.date} className={day.date === today ? "text-ink" : undefined}>
                {day.date === today ? "Ini" : DAY[new Date(`${day.date}T00:00:00Z`).getUTCDay()]}
              </span>
            ))}
          </div>
        </section>
      </div>

      <dl aria-label="Statistik" className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {[
          { label: "Total kata", value: stats.total, tone: "" },
          { label: "Sedang dipelajari", value: stats.tracked, tone: "" },
          { label: "Dikuasai", value: stats.mastered, tone: "text-primary" },
          { label: "Ingatan rata-rata", value: recall !== null ? `${recall}%` : "–", tone: "" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-plate border-2 border-hairline bg-surface px-5 py-[18px]">
            <dt className="text-[0.8125rem] font-bold text-ink-subtle">{stat.label}</dt>
            <dd className={cn("font-round text-[2rem] font-extrabold leading-tight", stat.tone)}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <form className="relative min-w-[240px] flex-[1_1_280px] sm:max-w-[420px]" action="/kosakata" role="search">
          {level !== "semua" ? <input type="hidden" name="level" value={level} /> : null}
          {topic ? <input type="hidden" name="topic" value={topic} /> : null}
          {status !== "semua" ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="kosa-q" className="sr-only">
            Cari kosakata
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-subtle" strokeWidth={2.4} aria-hidden />
          <input
            id="kosa-q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Cari kata atau arti…"
            className="h-12 w-full rounded-full border-2 border-hairline bg-surface pl-11 pr-4 text-[0.9375rem] focus:border-primary focus:outline-none"
          />
        </form>
        <nav aria-label="Filter status" className="flex flex-wrap gap-2">
          {STATUSES.map((value) => (
            <Link
              key={value}
              href={href({ status: value === "semua" ? null : value })}
              aria-current={status === value ? "true" : undefined}
              className={cn(
                "flex h-10 items-center rounded-full border-2 px-3.5 text-[0.875rem]",
                status === value ? "border-ink bg-ink font-extrabold text-white" : "border-hairline bg-surface font-bold hover:border-hairline-strong",
              )}
            >
              {STATUS_LABEL[value]}
              {value === "due" && stats.due > 0 ? ` · ${stats.due}` : ""}
              {value === "new" && newWaiting > 0 ? ` · ${newWaiting}` : ""}
            </Link>
          ))}
        </nav>
        <nav aria-label="Filter tingkat" className="flex flex-wrap gap-2 sm:ml-auto">
          {LEVELS.map((value) => (
            <Link
              key={value}
              href={href({ level: value === "semua" ? null : value })}
              aria-current={level === value ? "true" : undefined}
              className={cn(
                "flex h-10 items-center rounded-[12px] border-2 px-3 text-[0.8125rem]",
                level === value ? "border-primary-line bg-primary-soft font-extrabold text-primary-deep" : "border-hairline bg-surface font-bold text-ink-muted",
              )}
            >
              {LEVEL_LABEL[value]}
            </Link>
          ))}
        </nav>
      </div>

      {topics.length > 0 ? (
        <nav aria-label="Filter topik" className="-mt-2 flex flex-wrap gap-1.5">
          <Link
            href={href({ topic: null })}
            aria-current={!topic ? "true" : undefined}
            className={cn(
              "rounded-full border-2 px-3 py-1 text-[0.75rem] font-bold",
              !topic ? "border-primary-line bg-primary-soft text-primary-deep" : "border-hairline bg-surface text-ink-subtle",
            )}
          >
            Semua topik
          </Link>
          {topics.slice(0, 11).map((value) => {
            const active = topic === value.toLowerCase();
            return (
              <Link
                key={value}
                href={href({ topic: active ? null : value })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-full border-2 px-3 py-1 text-[0.75rem] font-bold",
                  active ? "border-primary-line bg-primary-soft text-primary-deep" : "border-hairline bg-surface text-ink-subtle",
                )}
              >
                {value}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {rows.length === 0 ? (
        <Card className="p-6">
          {hasFilter ? (
            <p className="text-[0.9375rem] text-ink-subtle">
              Tidak ada kata yang cocok. Coba hapus kata kunci atau filter, lalu cari lagi.
            </p>
          ) : (
            <p className="text-[0.9375rem] text-ink-subtle">
              Tidak ada kata yang cocok. Bank kosakata bisa ditambah lewat{" "}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">npm run db:vocab</code>.
            </p>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[24px] border-2 border-hairline bg-surface">
          <table className="w-full min-w-[560px] md:min-w-[820px] border-collapse text-[0.9375rem]">
            <thead>
              <tr className="bg-surface-muted text-left text-[0.75rem] font-extrabold uppercase tracking-[0.06em] text-ink-subtle">
                <th scope="col" className="px-5 py-3.5">Kata</th>
                <th scope="col" className="px-3 py-3.5">Arti</th>
                <th scope="col" className="hidden px-3 py-3.5 md:table-cell">Contoh</th>
                <th scope="col" className="px-3 py-3.5">Tingkat</th>
                <th scope="col" className="px-3 py-3.5">Ingatan</th>
                <th scope="col" className="py-3.5 pl-3 pr-5">Ulang</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ card, status: s }) => {
                const filled = Math.min(4, Math.ceil((card.box * 4) / 5));
                return (
                  <tr key={card.id} className="border-t-2 border-hairline-soft align-middle">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-2.5">
                        <SpeakButton text={card.word} label={`Dengarkan ${card.word}`} />
                        <span>
                          <strong className="block">{card.word}</strong>
                          <span className="text-[0.8125rem] text-ink-subtle">
                            {[card.phonetic, card.partOfSpeech].filter(Boolean).join(" · ") || card.topic || "umum"}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3.5">{card.meaning}</td>
                    <td className="hidden max-w-[300px] px-3 py-3.5 text-ink-muted md:table-cell">{card.exampleEn ? emphasize(card.exampleEn, card.word) : "–"}</td>
                    <td className="px-3 py-3.5">
                      <LevelTag level={card.cefr ?? (card.level === "basic" ? "Dasar" : card.level === "intermediate" ? "Menengah" : "Lanjut")} />
                    </td>
                    <td className="px-3 py-3.5">
                      {s.kind === "new" ? (
                        <span className="rounded-full bg-mango px-2 py-0.5 text-[0.75rem] font-extrabold text-mango-on">BARU</span>
                      ) : (
                        <span aria-label={`Ingatan ${filled} dari 4`} role="img" className="inline-flex gap-[3px]">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className={cn(
                                "h-2 w-3.5 rounded-[3px]",
                                i < filled ? (filled >= 3 ? "bg-primary" : "bg-mango") : "bg-canvas-deep",
                              )}
                            />
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-5">
                      {s.kind === "due" || s.kind === "new" ? (
                        <span className="rounded-full border-2 border-mango-line bg-mango-soft px-2.5 py-0.5 text-[0.75rem] font-extrabold text-mango-ink">
                          {s.kind === "due" ? "Hari ini" : "Belum"}
                        </span>
                      ) : (
                        <span className="text-[0.875rem] text-ink-subtle">{s.kind === "mastered" ? "Dikuasai" : s.label}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t-2 border-hairline-soft px-5 py-3.5 text-[0.875rem] text-ink-subtle">
            Menampilkan {rows.length} dari {matchedCount} kata
            {matchedCount > rows.length ? ". Persempit filter untuk melihat lainnya." : ""}
          </p>
        </div>
      )}
    </div>
  );
}
