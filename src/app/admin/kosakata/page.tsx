import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { vocabularyWordStats } from "@/db/queries/admin";
import { listVocabulary } from "@/db/queries/vocabulary";
import type { Vocabulary } from "@/db/schema";
import { isLeech, lapseRate, LEECH_LAPSES, LEECH_MIN_LEARNERS, missingFields } from "@/lib/admin";
import { cn } from "@/lib/utils";

import { Notice, param, type AdminSearchParams } from "../notice";
import { WordForm } from "./word-form";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const TABS = {
  all: "Semua",
  incomplete: "Belum lengkap",
  leech: "Kata leech",
  nocefr: "Tanpa CEFR",
} as const;
type Tab = keyof typeof TABS;

export default async function AdminVocabularyPage({
  searchParams }: { searchParams: AdminSearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const tabParam = param(params, "tab");
  const tab: Tab = tabParam && tabParam in TABS ? (tabParam as Tab) : "all";
  const q = param(params, "q")?.trim() ?? "";
  const page = Math.max(1, Number(param(params, "page")) || 1);
  const selectedId = Number(param(params, "id")) || null;
  const creating = param(params, "baru") === "1";

  const [words, stats] = await Promise.all([listVocabulary({ q }), vocabularyWordStats()]);

  const filters: Record<Tab, (word: Vocabulary) => boolean> = {
    all: () => true,
    incomplete: (word) => missingFields(word).length > 0,
    leech: (word) => isLeech(stats.get(word.id)),
    nocefr: (word) => !word.cefr,
  };
  const counts = Object.fromEntries(
    (Object.keys(TABS) as Tab[]).map((key) => [key, words.filter(filters[key]).length]),
  ) as Record<Tab, number>;

  const filtered = words.filter(filters[tab]).sort((a, b) =>
    tab === "leech"
      ? (stats.get(b.id)?.leechLearners ?? 0) - (stats.get(a.id)?.leechLearners ?? 0)
      : (a.frequencyRank ?? Number.MAX_SAFE_INTEGER) - (b.frequencyRank ?? Number.MAX_SAFE_INTEGER),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = creating ? null : (words.find((word) => word.id === selectedId) ?? shown[0] ?? null);
  const href = (next: Record<string, string>) =>
    `/admin/kosakata?${new URLSearchParams({ tab, ...(q ? { q } : {}), ...next }).toString()}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Mode admin"
        title="Kosakata"
        description={`${words.length} kata. Peringkat frekuensi menentukan kata yang muncul duluan di dek pelajar.`}
        actions={
          <Link href={href({ baru: "1" })} className={buttonVariants({ size: "sm" })}>
            Kata baru
          </Link>
        }
      />
      <Notice pesan={param(params, "pesan")} galat={param(params, "galat")} />

      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Saring kata" className="flex flex-wrap gap-2">
          {(Object.keys(TABS) as Tab[]).map((key) => (
            <Link
              key={key}
              href={`/admin/kosakata?${new URLSearchParams({ tab: key, ...(q ? { q } : {}) }).toString()}`}
              aria-current={key === tab ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-control border-2 px-3 text-[0.875rem] font-bold",
                key === tab ? "border-charcoal bg-charcoal text-white" : "border-hairline bg-surface",
              )}
            >
              {TABS[key]}
              <span className="tnum rounded-full bg-black/10 px-2 text-[0.75rem]">{counts[key]}</span>
            </Link>
          ))}
        </nav>
        <form className="ml-auto flex w-full min-w-0 flex-wrap gap-2 sm:w-auto" role="search">
          <input type="hidden" name="tab" value={tab} />
          <label htmlFor="cari" className="sr-only">Cari kata atau arti</label>
          <Input id="cari" name="q" defaultValue={q} placeholder="Cari kata atau arti…" className="h-11 min-w-0 flex-1 sm:w-64 sm:flex-none" />
          <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm", className: "h-11" })}>
            Cari
          </button>
        </form>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[0.875rem]">
            <thead className="bg-surface-muted text-left text-[0.75rem] uppercase tracking-[0.06em] text-ink-subtle">
              <tr>
                <th scope="col" className="px-4 py-3">Kata</th>
                <th scope="col" className="px-2 py-3">Arti</th>
                <th scope="col" className="px-2 py-3">CEFR</th>
                <th scope="col" className="px-2 py-3 text-right">Frek.</th>
                <th scope="col" className="px-2 py-3">Kurang</th>
                <th scope="col" className="w-36 px-4 py-3">% dilupa</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((word) => {
                const stat = stats.get(word.id);
                const rate = lapseRate(stat);
                const missing = missingFields(word);
                const active = selected?.id === word.id;
                return (
                  <tr key={word.id} className={cn("border-t-2 border-hairline", active && "bg-primary-soft")}>
                    <td className="px-4 py-2.5">
                      <Link href={href({ id: String(word.id), page: String(page) })} aria-current={active ? "true" : undefined} className="block min-h-10 text-ink no-underline">
                        <span className="block font-display text-[1rem] font-extrabold">{word.word}</span>
                        <span className="text-[0.75rem] text-ink-subtle">{word.partOfSpeech ?? "—"}</span>
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">{word.meaning}</td>
                    <td className="px-2 py-2.5">
                      <span className={cn("rounded-md px-2 py-0.5 text-[0.75rem] font-bold", word.cefr ? "bg-surface-muted" : "bg-brick-soft text-brick-deep")}>
                        {word.cefr ?? "—"}
                      </span>
                    </td>
                    <td className="tnum px-2 py-2.5 text-right font-mono text-[0.8125rem] text-ink-subtle">{word.frequencyRank ?? "—"}</td>
                    <td className="px-2 py-2.5 text-[0.75rem] font-bold text-brick-deep">{missing.join(", ") || <span className="text-primary">lengkap</span>}</td>
                    <td className="px-4 py-2.5">
                      {rate === null ? (
                        <span className="text-ink-faint">belum diulang</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                            <span className={cn("block h-full rounded-full", rate >= 0.3 ? "bg-brick" : "bg-mango")} style={{ width: `${Math.max(3, rate * 100)}%` }} />
                          </span>
                          <span className="tnum w-9 text-right text-[0.75rem] font-bold">{Math.round(rate * 100)}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 ? <p className="px-4 py-8 text-center text-ink-subtle">Tidak ada kata di kategori ini.</p> : null}
          {pages > 1 ? (
            <nav aria-label="Halaman" className="flex items-center justify-between gap-3 border-t-2 border-hairline px-4 py-3 text-[0.875rem]">
              <span className="text-ink-subtle">Halaman {page} dari {pages}</span>
              <span className="flex gap-2">
                {page > 1 ? <Link href={href({ page: String(page - 1) })} className="font-bold">Sebelumnya</Link> : null}
                {page < pages ? <Link href={href({ page: String(page + 1) })} className="font-bold">Berikutnya</Link> : null}
              </span>
            </nav>
          ) : null}
        </Card>

        <WordForm
          key={selected?.id ?? "baru"}
          word={selected}
          tab={tab}
          leech={
            selected && isLeech(stats.get(selected.id))
              ? { learners: stats.get(selected.id)?.leechLearners ?? 0, lapses: LEECH_LAPSES, minLearners: LEECH_MIN_LEARNERS }
              : null
          }
        />
      </div>
    </div>
  );
}
