import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { listDataRequests } from "@/db/queries/admin";
import { listStudents } from "@/db/queries/reporting";
import { formatDate, relativeDay } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

import { deleteUserDataAction, setRoleAction } from "../actions";
import { Notice, param, type AdminSearchParams } from "../notice";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const params = await searchParams;
  // Cek admin dulu, baru ambil data sensitif — App Router merender page dan
  // layout bersamaan, jadi Promise.all membuat query daftar pengguna tetap
  // dieksekusi untuk pengunjung anonim (hasilnya dibuang, bebannya tetap ada).
  const admin = await requireAdmin();
  const [students, requests] = await Promise.all([listStudents(), listDataRequests(20)]);
  const q = param(params, "q")?.trim().toLowerCase() ?? "";
  const shown = q
    ? students.filter((s) => s.username.toLowerCase().includes(q) || (s.displayName ?? "").toLowerCase().includes(q))
    : students;
  const selected = students.find((s) => s.id === Number(param(params, "id"))) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Mode admin"
        title="Pengguna & Privasi"
        description={`${students.length} akun. Setiap perubahan peran tercatat di log audit.`}
        actions={
          <form role="search" className="flex gap-2">
            <label htmlFor="cari-user" className="sr-only">Cari username</label>
            <input id="cari-user" name="q" defaultValue={q} placeholder="Cari username…" className="h-11 w-56 rounded-control border-2 border-hairline bg-surface px-3" />
            <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm", className: "h-11" })}>Cari</button>
          </form>
        }
      />
      <Notice pesan={param(params, "pesan")} galat={param(params, "galat")} />

      <Card className="p-4">
        <h2 className="font-display text-lg font-extrabold">Permintaan data pengguna (UU PDP)</h2>
        {requests.length === 0 ? (
          <p className="mt-1 text-[0.875rem] text-ink-subtle">Belum ada permintaan ekspor atau hapus data.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {requests.map((req) => (
              <li key={req.id} className={cn("flex flex-wrap items-center gap-3 rounded-control px-3 py-2 text-[0.875rem]", req.status === "pending" ? "bg-brick-soft" : "bg-surface-muted")}>
                <strong>{req.kind === "delete" ? "Hapus akun & data" : "Ekspor data"}</strong>
                <span>{req.username ? `@${req.username}` : "akun sudah dihapus"}</span>
                <span className="text-ink-subtle">{formatDate(req.createdAt)}</span>
                <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold", req.status === "pending" ? "bg-brick text-white" : "bg-primary-soft text-primary-deep")}>
                  {req.status === "pending" ? "menunggu" : "selesai"}
                </span>
                {req.kind === "delete" && req.status === "pending" && req.username ? (
                  <details className="w-full">
                    <summary className="cursor-pointer list-none text-[0.8125rem] font-extrabold text-brick-deep hover:underline [&::-webkit-details-marker]:hidden">
                      Proses hapus akun @{req.username}
                    </summary>
                    <form action={deleteUserDataAction} className="mt-2 flex flex-col gap-2 rounded-control border-2 border-brick/30 bg-surface p-3 shadow-overlay">
                      <input type="hidden" name="userId" value={req.userId} />
                      <p className="text-[0.8125rem] text-ink-muted">
                        Hapus permanen akun @{req.username} beserta semua datanya (progres, esai, XP, sesi tes). Tindakan ini tidak bisa dibatalkan.
                      </p>
                      <label className="flex items-start gap-2 text-[0.8125rem] text-ink">
                        <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 size-5 accent-[var(--color-brick)]" />
                        Saya paham penghapusan ini permanen dan tidak bisa dibatalkan.
                      </label>
                      <button type="submit" className={buttonVariants({ variant: "danger", size: "sm", className: "w-full" })}>
                        Ya, hapus akun @{req.username}
                      </button>
                    </form>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[0.875rem]">
            <thead className="bg-surface-muted text-left text-[0.75rem] uppercase tracking-[0.06em] text-ink-subtle">
              <tr>
                <th scope="col" className="px-4 py-3">Pengguna</th>
                <th scope="col" className="px-2 py-3">Peran</th>
                <th scope="col" className="px-2 py-3 text-right">XP</th>
                <th scope="col" className="px-2 py-3 text-right">Kata dikuasai</th>
                <th scope="col" className="px-2 py-3">Terakhir aktif</th>
                <th scope="col" className="px-4 py-3 text-right">Biaya AI</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((student) => (
                <tr key={student.id} className={cn("border-t-2 border-hairline", selected?.id === student.id && "bg-primary-soft")}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/pengguna?id=${student.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="flex min-h-10 items-center font-bold text-ink">
                      @{student.username}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={cn("rounded-md px-2 py-0.5 text-[0.75rem] font-bold", student.role === "admin" ? "bg-mango-soft text-mango-ink" : "bg-surface-muted text-ink-subtle")}>
                      {student.role === "admin" ? "Admin" : "Pengguna"}
                    </span>
                  </td>
                  <td className="tnum px-2 py-2.5 text-right">{student.xpTotal}</td>
                  <td className="tnum px-2 py-2.5 text-right">{student.vocabMastered}</td>
                  <td className="px-2 py-2.5 text-ink-subtle">{student.lastActive ? relativeDay(student.lastActive) : "belum pernah"}</td>
                  <td className="tnum px-4 py-2.5 text-right">${student.aiCostUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            {shown.length === 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-subtle">
                    Tidak ada pengguna yang cocok dengan pencarian.
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </Card>

        <Card className="flex flex-col gap-4 p-5 xl:sticky xl:top-6">
          {selected ? (
            <>
              <div>
                <h2 className="font-display text-xl font-extrabold">@{selected.username}</h2>
                <p className="text-[0.8125rem] text-ink-subtle">Bergabung {formatDate(selected.createdAt)}</p>
              </div>
              <form action={setRoleAction} className="flex flex-col gap-3">
                <input type="hidden" name="userId" value={selected.id} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="role">Peran</Label>
                  <select id="role" name="role" defaultValue={selected.role} className="h-11 rounded-control border-2 border-hairline bg-surface px-3 font-bold">
                    <option value="user">Pengguna</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {selected.role !== "admin" ? (
                  <label className="flex items-start gap-2 rounded-control bg-brick-soft p-3 text-[0.8125rem] text-brick-deep">
                    <input type="checkbox" name="confirm" value="yes" className="mt-0.5 size-5 accent-[var(--color-brick)]" />
                    Saya paham admin bisa mengubah soal, kosakata, dan peran pengguna lain.
                  </label>
                ) : null}
                {selected.id === admin.id ? (
                  <p className="text-[0.8125rem] text-ink-subtle">Ini akunmu sendiri. Peran admin tidak bisa kamu cabut dari sini.</p>
                ) : null}
                <button type="submit" className={buttonVariants()}>Simpan peran</button>
              </form>
            </>
          ) : (
            <p className="text-ink-subtle">Pilih pengguna di tabel untuk mengubah perannya.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
