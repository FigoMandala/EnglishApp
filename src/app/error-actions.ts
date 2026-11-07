"use server";

import { headers } from "next/headers";

import { logAudit } from "@/lib/security";

/**
 * Laporkan error yang tertangkap error boundary klien agar tercatat di
 * audit_logs dan terlihat di dashboard admin — monitoring tanpa layanan luar.
 * Tidak melempar error: pelaporan gagal tidak boleh menambah masalah.
 */
export async function logClientErrorAction(input: { message: string; digest?: string }): Promise<{ ok: boolean }> {
  try {
    const message = String(input.message ?? "").slice(0, 300);
    const digest = typeof input.digest === "string" ? input.digest.slice(0, 64) : "";
    let path = "";
    try {
      path = (await headers()).get("referer") ?? "";
    } catch {
      path = "";
    }
    await logAudit({
      action: "client_error",
      detail: `${message}${digest ? ` [${digest}]` : ""}${path ? ` @ ${path}` : ""}`,
    });
  } catch {
    // diam: jangan pernah melempar dari pelapor error
  }
  return { ok: true };
}
