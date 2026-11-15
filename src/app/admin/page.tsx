import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { ActivityBars } from "@/components/charts";
import { Kaka } from "@/components/mascot";
import { adminCounts, bankHealth, recentAuditLogs } from "@/db/queries/admin";
import { usageOverview } from "@/db/queries/ai-usage";
import { dailyBudgetUsd } from "@/lib/ai-budget";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/session";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

const usd = (value: number) => `$${value.toFixed(2)}`;

export default async function AdminHome() {
  await requireAdmin();
  const [counts, usage, bank, logs, budget] = await Promise.all([
    adminCounts(),
    usageOverview(7),
    bankHealth("eptr"),
    recentAuditLogs(8),
    dailyBudgetUsd(),
  ]);
  const spent = usage.todayTotals.costUsd;
  const { faulty, tooEasy, unknown } = bank;

  const days = usage.byDay.slice(-7).map((day) => ({
    label: day.date.slice(5).replace("-", "/"),
    value: Math.round(day.totals.costUsd * 100) / 100,
  }));

  const alerts = [
    { n: faulty, text: "soal TOEFL ITP kemungkinan kuncinya salah (otomatis dilewati picker)", href: "/admin/soal?status=faulty", tone: "bg-brick-soft text-brick-deep" },
    { n: tooEasy, text: "soal TOEFL ITP terlalu mudah untuk levelnya", href: "/admin/soal?status=too-easy", tone: "bg-mango-soft text-mango-ink" },
    { n: unknown, text: "soal belum cukup dijawab untuk dinilai", href: "/admin/soal?status=unknown", tone: "bg-surface-muted text-ink-subtle" },
    { n: counts.flagsOpen, text: "flag moderasi belum ditinjau", href: "/admin/moderasi", tone: "bg-sky-soft text-sky-deep" },
  ];
  const visibleAlerts = alerts.filter((alert) => alert.n > 0);

  const kpis = [
    { label: "Pengguna", value: String(counts.users), hint: `${counts.activeToday} aktif hari ini` },
    { label: "Soal di bank", value: String(counts.bankEptr + counts.bankToefl), hint: `TOEFL ITP ${counts.bankEptr} · TOEFL ${counts.bankToefl}` },
    { label: "Biaya AI hari ini", value: usd(spent), hint: `batas ${usd(budget)}`, progress: Math.min(100, (spent / budget) * 100) },
    { label: "Flag belum ditinjau", value: String(counts.flagsOpen), hint: `${counts.flagsWeek} masuk 7 hari`, alert: counts.flagsOpen > 0 },
  ];
  const DOT: Record<string, string> = {
    "bg-brick-soft text-brick-deep": "bg-brick",
    "bg-mango-soft text-mango-ink": "bg-mango",
    "bg-surface-muted text-ink-subtle": "bg-ink-faint",
    "bg-sky-soft text-sky-deep": "bg-sky",
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] font-black">Ringkasan</h1>
          <p className="mt-0.5 text-ink-subtle">Kondisi aplikasi hari ini, dari data asli database.</p>
        </div>
      </header>

      <dl aria-label="Angka utama" className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={cn(
              "flex flex-col gap-1 rounded-[20px] border-2 px-5 py-[18px]",
              kpi.alert ? "border-brick-line bg-brick-soft" : "border-hairline bg-surface",
            )}
          >
            <dt className={cn("text-[0.8125rem] font-bold", kpi.alert ? "text-brick-deep" : "text-ink-subtle")}>{kpi.label}</dt>
            <dd className="flex flex-wrap items-baseline gap-2">
              <span className={cn("tnum font-round text-[2rem] font-extrabold leading-none", kpi.alert && "text-brick-deep")}>
                {kpi.value}
              </span>
              <span className="text-[0.8125rem] text-ink-subtle">{kpi.hint}</span>
            </dd>
            {kpi.progress !== undefined ? (
              <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <span
                  className={cn("block h-full rounded-full", kpi.progress >= 90 ? "bg-brick" : "bg-mango")}
                  style={{ width: `${kpi.progress}%` }}
                />
              </span>
            ) : null}
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-stretch gap-6">
        <section aria-labelledby="cost-t" className="flex min-w-0 flex-[1_1_480px] flex-col gap-3.5 rounded-[24px] border-2 border-hairline bg-surface px-6 py-[22px]">
          <h2 id="cost-t" className="font-display text-[1.125rem] font-extrabold">
            Biaya AI 7 hari (USD)
          </h2>
          {days.length ? <ActivityBars data={days} unit=" USD" /> : <p className="text-ink-subtle">Belum ada pemakaian AI.</p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {usage.byFeature.map((row) => (
              <li key={row.feature} className="flex justify-between gap-3 rounded-[12px] bg-surface-muted px-3 py-2 text-[0.875rem]">
                <span className="font-bold capitalize">{row.feature}</span>
                <span className="tnum text-ink-subtle">
                  {row.totals.requests} panggilan · {usd(row.totals.costUsd)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="att-t" className="flex min-w-[280px] flex-[0_1_360px] flex-col gap-2.5 rounded-[24px] border-2 border-hairline bg-surface px-6 py-[22px]">
          <div className="flex items-center gap-3">
            <Kaka mood={faulty > 0 ? "warn" : "coach"} size={48} still />
            <h2 id="att-t" className="font-display text-[1.125rem] font-extrabold">
              Perlu perhatian
            </h2>
          </div>
          {visibleAlerts.length === 0 ? (
            <p className="flex items-center gap-2 p-3 text-[0.875rem] text-ink-subtle">
              <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
              Semua beres — tidak ada item bermasalah hari ini.
            </p>
          ) : (
            visibleAlerts.map((alert) => (
              <Link key={alert.href} href={alert.href} className={cn("flex gap-3 rounded-[14px] p-3 text-[0.875rem] text-ink", alert.tone.split(" ")[0])}>
                <span className={cn("mt-[7px] size-2.5 shrink-0 rounded-full", DOT[alert.tone])} aria-hidden />
                <span>
                  <strong className="block font-round text-[1.125rem]">{alert.n}</strong>
                  {alert.text}
                </span>
              </Link>
            ))
          )}
        </section>
      </div>

      <section aria-labelledby="log-t" className="overflow-x-auto rounded-[24px] border-2 border-hairline bg-surface">
        <h2 id="log-t" className="px-6 pb-2 pt-[18px] font-display text-[1.125rem] font-extrabold">
          Aktivitas admin terbaru
        </h2>
        {logs.length ? (
          <table className="w-full min-w-[680px] text-[0.875rem]">
            <thead>
              <tr className="bg-surface-muted text-left text-[0.75rem] font-extrabold uppercase tracking-[0.06em] text-ink-subtle">
                <th scope="col" className="px-6 py-3">Waktu</th>
                <th scope="col" className="p-3">Admin</th>
                <th scope="col" className="p-3">Aksi</th>
                <th scope="col" className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t-2 border-hairline-soft">
                  <td className="tnum whitespace-nowrap px-6 py-3 text-ink-subtle">{formatDateTime(log.createdAt)}</td>
                  <td className="p-3 font-bold">{log.actor ? `@${log.actor}` : "sistem"}</td>
                  <td className="p-3">
                    <span className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-[0.75rem] font-extrabold text-primary-deep">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-6 pb-5 text-ink-subtle">Belum ada catatan.</p>
        )}
      </section>
    </div>
  );
}
