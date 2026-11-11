import { headers } from "next/headers";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";

import { clientIp } from "./rate-limit";

/**
 * Verifikasi Origin header untuk mutasi server action (mitigasi CSRF).
 * sameSite=lax menolong, tapi cek eksplisit menutup celah. Browser selalu
 * mengirim Sec-Fetch-Site; kalau header itu ada dan bilang cross-site,
 * tolak meski Origin-nya sedang tidak ada (audit keamanan P3).
 */
export async function verifyOrigin(): Promise<boolean> {
  const store = await headers();
  const fetchSite = store.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
    return false;
  }
  const origin = store.get("origin");
  const host = store.get("host");
  if (!origin) return true; // non-browser (mis. fetch server) — biarkan route lain yang menjaga
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Guard: lempar error kalau origin tidak cocok. */
export async function assertSameOrigin() {
  if (!(await verifyOrigin())) {
    throw new Error("Permintaan ditolak: origin tidak cocok.");
  }
}

export async function logAudit(entry: {
  actorId?: number | null;
  action: string;
  detail?: string;
}) {
  const store = await headers();
  await db.insert(auditLogs).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    detail: entry.detail ?? null,
    ip: clientIp(store),
    userAgent: store.get("user-agent")?.slice(0, 300) ?? null,
  });
}