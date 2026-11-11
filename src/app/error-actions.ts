"use server";

import { headers } from "next/headers";

import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/security";

/** Batas laporan error per IP: cukup untuk insiden nyata, membatasi banjir tulisan. */
const CLIENT_ERROR_LIMIT = 10;
const CLIENT_ERROR_WINDOW_MS = 5 * 60_000;

/**
 * Laporkan error yang tertangkap error boundary klien agar tercatat di
 * audit_logs dan terlihat di dashboard admin — monitoring tanpa layanan luar.
 * Tidak melempar error: pelaporan gagal tidak boleh menambah masalah.
 * Action ini bisa dipanggil anonim (halaman login ikut melapor), jadi
 * diam-diam dibatasi rate limit per IP supaya audit_logs tidak bisa
 * dibanjiri dan menenggelamkan event admin yang penting (audit keamanan P2).
 */
export async function logClientErrorAction(input: { message: string; digest?: string }): Promise<{ ok: boolean }> {
  try {
    const store = await headers();
    const limit = await checkRateLimit(`client-error:ip:${clientIp(store)}`, CLIENT_ERROR_LIMIT, CLIENT_ERROR_WINDOW_MS);
    if (!limit.ok) return { ok: true };

    const message = String(input.message ?? "").slice(0, 300);
    const digest = typeof input.digest === "string" ? input.digest.slice(0, 64) : "";
    // Referer bisa memuat token di query — dipotong pendek dan hanya path-nya.
    let path = "";
    try {
      const referer = store.get("referer") ?? "";
      path = referer.startsWith("http") ? (new URL(referer).pathname.slice(0, 120) ?? "") : referer.slice(0, 120);
    } catch {
      path = "";
    }
    await logAudit({
      action: "client_error",
      detail: `${message}${digest ? ` [${digest}]` : ""}${path ? ` @ ${path}` : ""}`.slice(0, 500),
    });
  } catch {
    // diam: jangan pernah melempar dari pelapor error
  }
  return { ok: true };
}
