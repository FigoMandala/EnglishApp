import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { listBankItems, type BankStatus } from "@/db/queries/admin";
import { EXPECTED_ACCURACY, MIN_ATTEMPTS } from "@/lib/calibration";
import { cn } from "@/lib/utils";

import { retireBankItemAction } from "../actions";
import { Notice, param, type AdminSearchParams } from "../notice";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const STATUS: Record<BankStatus, { label: string; tone: string; dot: string }> = {
  faulty: { label: "Kunci bermasalah", tone: "bg-brick-soft text-brick-deep", dot: "bg-brick" },
  "too-easy": { label: "Terlalu mudah", tone: "bg-mango-soft text-mango-ink", dot: "bg-mango" },
  ok: { label: "Sesuai", tone: "bg-primary-soft text-primary-deep", dot: "bg-primary" },
  unknown: { label: "Data kurang", tone: "bg-surface-muted text-ink-subtle", dot: "bg-hairline-strong" },
};

export default async function AdminBankPage({
  searchParams }: { searchParams: AdminSearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const track = param(params, "track") === "toefl" ? "toefl" : "eptr";
  const statusParam = param(params, "status");
  const status = statusParam && statusParam in STATUS ? (statusParam as BankStatus) : "all";
  const page = Math.max(1, Number(param(params, "page")) || 1);

  const items = await listBankItems(track);
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const filtered = status === "all" ? items : items.filter((item) => item.status === status);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (next: Record<string, string>) => `/admin/soal?${new URLSearchParams({ track, status, ...next }).toString()}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Mode admin"
        title="Bank Soal"
        description={`Status dihitung dari jawaban pengguna, sama seperti aturan picker soal. Soal dinilai setelah ${MIN_ATTEMPTS} jawaban.`}
        actions={
          <div className="flex rounded-control border-2 border-hairline bg-surface p-1" role="group" aria-label="Jenis tes">
            {(["eptr", "toefl"] as const).map((value) => (
              <Link
                key={value}
                href={`/admin/soal?track=${value}`}
                aria-current={value === track ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center rounded-[10px] px-4 font-bold uppercase",
                  value === track ? "bg-charcoal text-white" : "text-ink-subtle hover:text-ink",
                )}
              >
                {value}
              </Link>
            ))}
          </div>
        }
      />
      <Notice pesan={param(params, "pesan")} galat={param(params, "galat")} />

      <nav aria-label="Saring status" className="flex flex-wrap gap-2">
        {(["all", "faulty", "too-easy", "ok", "unknown"] as const).map((value) => {
          const active = value === status;
          return (
            <Link
              key={value}
              href={href({ status: value })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-control border-2 px-3 text-[0.875rem] font-bold",
                active ? "border-charcoal bg-charcoal text-white" : "border-hairline bg-surface hover:border-hairline-strong",
              )}
            >
              {value !== "all" ? <span aria-hidden className={cn("size-2.5 rounded-full", STATUS[value].dot)} /> : null}
              {value === "all" ? "Semua" : STATUS[value].label}
              <span className="tnum rounded-full bg-black/10 px-2 text-[0.75rem]">{value === "all" ? items.length : counts[value] ?? 0}</span>
            </Link>
          );
        })}
      </nav>

      {/* relative: containing block untuk span sr-only di header tabel. */}
      <Card className="relative overflow-x-auto">
        <table className="w-full min-w-[860px] text-[0.875rem]">
          <thead className="bg-surface-muted text-left text-[0.75rem] uppercase tracking-[0.06em] text-ink-subtle">
            <tr>
              <th scope="col" className="px-4 py-3">ID</th>
              <th scope="col" className="px-2 py-3">Soal</th>
              <th scope="col" className="px-2 py-3">Level</th>
              <th scope="col" className="px-2 py-3 text-right">Dijawab</th>
              <th scope="col" className="w-48 px-2 py-3">% benar vs target</th>
              <th scope="col" className="px-2 py-3">Status</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => {
              const [low, high] = EXPECTED_ACCURACY[item.levelBand];
              const rate = item.attempts ? item.correct / item.attempts : null;
              const meta = STATUS[item.status];
              return (
                <tr key={item.id} className="border-t-2 border-hairline align-top">
                  <td className="tnum px-4 py-3 font-mono text-[0.8125rem] text-ink-subtle">#{item.id}</td>
                  <td className="max-w-[340px] px-2 py-3">
                    <p className="line-clamp-2 font-bold">{item.preview}</p>
                    <p className="text-[0.75rem] text-ink-subtle">
                      {item.kind}
                      {item.skill ? ` · ${item.skill}` : ""} · {item.questions} soal
                    </p>
                  </td>
                  <td className="px-2 py-3">
                    <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[0.75rem] font-bold">{item.levelBand}</span>
                  </td>
                  <td className="tnum px-2 py-3 text-right font-bold">{item.attempts}</td>
                  <td className="px-2 py-3">
                    <div
                      role="img"
                      aria-label={rate === null ? "Belum dijawab" : `${Math.round(rate * 100)} persen benar, target ${low * 100} sampai ${high * 100} persen`}
                      className="relative h-3.5 rounded-full bg-surface-sunken"
                    >
                      <span className="absolute inset-y-0 rounded bg-primary-soft" style={{ left: `${low * 100}%`, width: `${(high - low) * 100}%` }} />
                      {rate !== null ? (
                        <span className={cn("absolute left-0 top-1 h-1.5 rounded-full", meta.dot)} style={{ width: `${Math.max(2, rate * 100)}%` }} />
                      ) : null}
                    </div>
                    <p className="tnum mt-1 text-[0.75rem] font-bold text-ink-subtle">
                      {rate === null ? "—" : `${Math.round(rate * 100)}%`} · target {low * 100}–{high * 100}%
                    </p>
                  </td>
                  <td className="px-2 py-3">
                    <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[0.75rem] font-bold", meta.tone)}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/soal/${item.id}`}
                        className="flex min-h-10 items-center rounded-[10px] border-2 border-hairline px-3 font-bold text-ink transition-[border-color,transform] hover:border-primary active:translate-y-[2px]"
                      >
                        Edit
                      </Link>
                      <details>
                        <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-[10px] border-2 border-hairline px-3 font-bold transition-[border-color,transform] hover:border-brick hover:text-brick-deep active:translate-y-[2px]">
                          Tarik
                        </summary>
                        <form action={retireBankItemAction} className="mt-2 w-60 rounded-control border-2 border-brick/30 bg-surface p-3 shadow-overlay">
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="track" value={track} />
                          <input type="hidden" name="status" value={status} />
                          <p className="text-[0.8125rem] text-ink-muted">Hapus item ini dari bank? Pengguna tidak akan mendapatkannya lagi. Statistik jawaban tetap tersimpan.</p>
                          <button type="submit" className="ledge mt-2 min-h-10 w-full rounded-[10px] bg-brick font-bold text-white [--ledge:var(--color-brick-deep)]">
                            Ya, tarik soal #{item.id}
                          </button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 ? <p className="px-4 py-8 text-center text-ink-subtle">Tidak ada soal di kategori ini.</p> : null}
      </Card>

      {pages > 1 ? (
        <nav aria-label="Halaman" className="flex items-center justify-between gap-3 text-[0.875rem] text-ink-subtle">
          <span>
            Halaman {page} dari {pages} · {filtered.length} item
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} className="flex min-h-10 items-center rounded-[10px] border-2 border-hairline bg-surface px-4 font-bold transition-[border-color,transform] active:translate-y-[2px]">
                Sebelumnya
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={href({ page: String(page + 1) })} className="flex min-h-10 items-center rounded-[10px] border-2 border-hairline bg-surface px-4 font-bold transition-[border-color,transform] active:translate-y-[2px]">
                Berikutnya
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
