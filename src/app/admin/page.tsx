import { Coins, ListChecks, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";

import { ActivityBars, KpiCard } from "@/components/charts";
import { Kaka } from "@/components/mascot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { adminCounts, listBankItems, recentAuditLogs } from "@/db/queries/admin";
import { usageOverview } from "@/db/queries/ai-usage";
import { dailyBudgetUsd } from "@/lib/ai-budget";

export const dynamic = "force-dynamic";

const usd = (value: number) => `$${value.toFixed(2)}`;

export default async function AdminHome() {
  const [counts, usage, bank, logs, budget] = await Promise.all([
    adminCounts(),
    usageOverview(7),
    listBankItems("eptr"),
    recentAuditLogs(8),
    dailyBudgetUsd(),
  ]);
  const spent = usage.todayTotals.costUsd;
  const faulty = bank.filter((item) => item.status === "faulty").length;
  const tooEasy = bank.filter((item) => item.status === "too-easy").length;
  const unknown = bank.filter((item) => item.status === "unknown").length;

  const days = usage.byDay.slice(-7).map((day) => ({
    label: day.date.slice(5).replace("-", "/"),
    value: Math.round(day.totals.costUsd * 100) / 100,
  }));

  const alerts = [
    { n: faulty, text: "item EPrT kemungkinan kuncinya salah (otomatis dilewati picker)", href: "/admin/soal?status=faulty", tone: "bg-brick-soft text-brick-deep" },
    { n: tooEasy, text: "item EPrT terlalu mudah untuk levelnya", href: "/admin/soal?status=too-easy", tone: "bg-mango-soft text-mango-ink" },
    { n: unknown, text: "item belum cukup dijawab untuk dinilai", href: "/admin/soal?status=unknown", tone: "bg-surface-muted text-ink-subtle" },
    { n: counts.flagsOpen, text: "flag moderasi belum ditinjau", href: "/admin/moderasi", tone: "bg-sky-soft text-sky-deep" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Mode admin" title="Ringkasan" description="Kondisi aplikasi hari ini, dari data asli database." />

      <section aria-label="Angka utama" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pengguna" hint={`${counts.activeToday} aktif hari ini`} value={String(counts.users)} icon={<Users className="size-5" aria-hidden />} />
        <KpiCard label="Soal di bank" hint={`EPrT ${counts.bankEptr} · TOEFL ${counts.bankToefl}`} value={String(counts.bankEptr + counts.bankToefl)} icon={<ListChecks className="size-5" aria-hidden />} />
        <KpiCard
          label="Biaya AI hari ini"
          hint={`batas harian ${usd(budget)}`}
          value={usd(spent)}
          tone="dark"
          progress={(spent / budget) * 100}
          icon={<Coins className="size-5" aria-hidden />}
        />
        <KpiCard label="Flag belum ditinjau" hint={`${counts.flagsWeek} masuk 7 hari terakhir`} value={String(counts.flagsOpen)} icon={<ShieldAlert className="size-5" aria-hidden />} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Biaya AI 7 hari (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            {days.length ? <ActivityBars data={days} unit=" USD" /> : <p className="text-ink-subtle">Belum ada pemakaian AI.</p>}
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {usage.byFeature.map((row) => (
                <li key={row.feature} className="flex justify-between gap-3 rounded-control bg-surface-muted px-3 py-2 text-[0.875rem]">
                  <span className="font-bold capitalize">{row.feature}</span>
                  <span className="tnum text-ink-subtle">
                    {row.totals.requests} panggilan · {usd(row.totals.costUsd)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <Kaka mood={faulty > 0 ? "warn" : "coach"} size={64} />
            <CardTitle>Perlu perhatian</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {alerts.map((alert) => (
                <li key={alert.href}>
                  <Link href={alert.href} className={`flex min-h-12 items-center gap-3 rounded-control px-3 py-2 text-[0.875rem] ${alert.tone}`}>
                    <strong className="font-round text-xl">{alert.n}</strong>
                    <span>{alert.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktivitas admin terbaru</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {logs.length ? (
            <table className="w-full min-w-[560px] text-[0.875rem]">
              <thead>
                <tr className="text-left text-[0.75rem] uppercase tracking-[0.06em] text-ink-subtle">
                  <th scope="col" className="py-2 pr-3">Waktu</th>
                  <th scope="col" className="py-2 pr-3">Admin</th>
                  <th scope="col" className="py-2 pr-3">Aksi</th>
                  <th scope="col" className="py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t-2 border-hairline">
                    <td className="tnum whitespace-nowrap py-2 pr-3 text-ink-subtle">{log.createdAt}</td>
                    <td className="py-2 pr-3 font-bold">{log.actor ? `@${log.actor}` : "sistem"}</td>
                    <td className="py-2 pr-3 font-mono text-[0.8125rem]">{log.action}</td>
                    <td className="py-2">{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-ink-subtle">Belum ada catatan.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
