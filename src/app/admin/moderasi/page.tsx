import Link from "next/link";

import { Lori } from "@/components/mascot";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { adminCounts, listModerationFlags } from "@/db/queries/admin";
import { usageOverview } from "@/db/queries/ai-usage";
import { BUDGET_MAX_USD, BUDGET_MIN_USD, dailyBudgetUsd } from "@/lib/ai-budget";
import { cn } from "@/lib/utils";

import { reopenFlagAction, resolveFlagAction, setBudgetAction } from "../actions";
import { Notice, param, type AdminSearchParams } from "../notice";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  "prompt-injection": "Upaya membobol instruksi AI",
  explicit: "Konten eksplisit",
  harassment: "Kata kasar / pelecehan",
  violence: "Kekerasan",
  blocked: "Diblokir filter",
};

const usd = (value: number) => `$${value.toFixed(2)}`;

export default async function AdminModerationPage({
  searchParams }: { searchParams: AdminSearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const view = param(params, "lihat") === "selesai" ? "reviewed" : "open";
  const [flags, usage, budget, counts] = await Promise.all([
    listModerationFlags(view, 50),
    usageOverview(30),
    dailyBudgetUsd(),
    adminCounts(),
  ]);
  const spent = usage.todayTotals.costUsd;
  const used = Math.min(100, (spent / budget) * 100);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Mode admin" title="Moderasi & AI" description="Konten yang ditandai filter otomatis, plus pemakaian dan biaya AI." />
      <Notice pesan={param(params, "pesan")} galat={param(params, "galat")} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-label="Flag moderasi" className="flex flex-col gap-3">
          <nav aria-label="Status tinjauan" className="flex gap-2">
            {[
              { key: "open", label: `Belum ditinjau · ${counts.flagsOpen}`, href: "/admin/moderasi" },
              { key: "reviewed", label: "Sudah ditinjau", href: "/admin/moderasi?lihat=selesai" },
            ].map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={tab.key === view ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-control border-2 px-3 text-[0.875rem] font-bold",
                  tab.key === view ? "border-charcoal bg-charcoal text-white" : "border-hairline bg-surface",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {view === "open" && counts.flagsOpen > 50 ? (
            <p className="text-[0.8125rem] text-ink-subtle">Menampilkan 50 flag terbaru dari {counts.flagsOpen}.</p>
          ) : null}

          {flags.length === 0 ? (
            <Card className="flex items-center gap-4 p-5">
              <Lori mood="cheer" size={80} still />
              <p className="font-bold text-primary-deep">
                {view === "open" ? "Antrean bersih! Semua flag sudah ditinjau." : "Belum ada flag yang ditinjau."}
              </p>
            </Card>
          ) : (
            flags.map((flag) => (
              <Card key={flag.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
                  <strong className="text-[0.9375rem]">{REASON[flag.reason] ?? flag.reason}</strong>
                  <span className="rounded-md bg-surface-muted px-2 py-0.5 font-bold">{flag.feature}</span>
                  <span className={cn("rounded-md px-2 py-0.5 font-bold", flag.direction === "input" ? "bg-sky-soft text-sky-deep" : "bg-mango-soft text-mango-ink")}>
                    {flag.direction === "input" ? "dari pengguna" : "dari AI"}
                  </span>
                  <span className="ml-auto text-ink-subtle">
                    {flag.username ? `@${flag.username}` : "pengguna dihapus"} · {formatDateTime(flag.createdAt)}
                  </span>
                </div>
                {/* Cuplikan disembunyikan dulu supaya peninjau tidak terpapar konten tanpa sengaja. */}
                <details className="rounded-control border-2 border-dashed border-hairline bg-surface-muted px-3 py-2">
                  <summary className="cursor-pointer text-[0.8125rem] font-bold text-ink-subtle">Tampilkan cuplikan</summary>
                  <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[0.8125rem]">{flag.excerpt}</p>
                </details>
                {flag.resolution ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-[0.8125rem] font-bold", flag.resolution === "safe" ? "text-primary-deep" : "text-brick-deep")}>
                      {flag.resolution === "safe" ? "Ditandai aman" : "Ditindak"} · {flag.reviewedAt ? formatDateTime(flag.reviewedAt) : "-"}
                    </p>
                    <form action={reopenFlagAction}>
                      <input type="hidden" name="id" value={flag.id} />
                      <button
                        type="submit"
                        className="min-h-10 rounded-[10px] border-2 border-hairline bg-surface px-3 text-[0.8125rem] font-bold text-ink-subtle"
                      >
                        Buka ulang
                      </button>
                    </form>
                  </div>
                ) : (
                  <form action={resolveFlagAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={flag.id} />
                    <button type="submit" name="resolution" value="safe" className="min-h-10 rounded-[10px] border-2 border-primary/30 bg-primary-soft px-3 text-[0.8125rem] font-bold text-primary-deep">
                      Aman, tutup
                    </button>
                    <button type="submit" name="resolution" value="actioned" className="min-h-10 rounded-[10px] border-2 border-brick/30 bg-brick-soft px-3 text-[0.8125rem] font-bold text-brick-deep">
                      Ditindak
                    </button>
                  </form>
                )}
              </Card>
            ))
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Anggaran AI hari ini</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="font-round text-3xl font-extrabold">
                {usd(spent)} <span className="text-base font-semibold text-ink-subtle">dari {usd(budget)}</span>
              </p>
              <div className="h-3 overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={`${Math.round(used)} persen anggaran terpakai`}>
                <div className={cn("h-full rounded-full", used >= 80 ? "bg-brick" : "bg-mango")} style={{ width: `${used}%` }} />
              </div>
              <form action={setBudgetAction} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="budget">Batas harian (USD)</Label>
                  <Input id="budget" name="budget" type="number" min={BUDGET_MIN_USD} max={BUDGET_MAX_USD} step="0.5" defaultValue={budget} required className="h-11" />
                </div>
                <button type="submit" className={buttonVariants({ size: "sm", className: "h-11" })}>Simpan</button>
              </form>
              <p className="text-[0.8125rem] text-ink-subtle">
                Kalau batas tercapai, Tutor, Writing, dan pembuatan soal AI berhenti sampai besok. Latihan biasa tetap jalan.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per fitur · 30 hari</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-[0.875rem]">
                <thead className="text-left text-[0.75rem] uppercase tracking-[0.06em] text-ink-subtle">
                  <tr>
                    <th scope="col" className="py-1.5">Fitur</th>
                    <th scope="col" className="py-1.5 text-right">Panggilan</th>
                    <th scope="col" className="py-1.5 text-right">Gagal</th>
                    <th scope="col" className="py-1.5 text-right">Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.byFeature.map((row) => {
                    const errorRate = row.totals.requests ? row.totals.errors / row.totals.requests : 0;
                    return (
                      <tr key={row.feature} className="tnum border-t-2 border-hairline">
                        <td className="py-2 font-bold capitalize">{row.feature}</td>
                        <td className="py-2 text-right">{row.totals.requests}</td>
                        <td className={cn("py-2 text-right font-bold", errorRate >= 0.03 ? "text-brick-deep" : "text-primary-deep")}>
                          {(errorRate * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 text-right">{usd(row.totals.costUsd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pemakai terbesar · 30 hari</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2 text-[0.875rem]">
                {usage.perUser.slice(0, 8).map((row) => (
                  <li key={row.userId} className="tnum flex justify-between gap-3">
                    <span className="font-bold">@{row.username}</span>
                    <span className="text-ink-subtle">
                      {row.totals.requests} panggilan · {usd(row.totals.costUsd)}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
