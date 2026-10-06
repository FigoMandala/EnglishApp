import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Rate limiter berbasis tabel (aman untuk serverless multi-instance).
 * Fixed-window sederhana: hitungan per key, reset setelah windowMs.
 * Penaikan hitungan memakai UPDATE atomik supaya dua request paralel tidak
 * sama-sama lolos pengecekan (race read-then-write).
 */
export type RateLimitResult = { ok: boolean; remaining: number; retryAfterMs: number };

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const nowStr = String(now);

  // 1) Jendela masih berlaku dan masih ada sisa kuota: naikkan atomik.
  const bumped = await db
    .update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1`, updatedAt: sql`(datetime('now'))` })
    .where(and(eq(rateLimits.key, key), lt(rateLimits.count, limit)))
    .returning({ count: rateLimits.count });

  if (bumped.length > 0) {
    const count = bumped[0].count;
    return { ok: true, remaining: Math.max(0, limit - count), retryAfterMs: 0 };
  }

  // 2) Belum ada baris, atau jendela sudah kedaluwarsa: coba buat ulang.
  const reset = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: nowStr })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: { count: 1, windowStart: nowStr, updatedAt: sql`(datetime('now'))` },
      // Hanya reset kalau jendela lama sudah lewat; kalau masih penuh, biarkan.
      where: sql`${rateLimits.windowStart} <= ${String(now - windowMs)}`,
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  if (reset.length > 0) {
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  // 3) Jendela masih aktif dan kuota habis: tolak.
  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const windowStart = Number(row?.windowStart) || now;
  return { ok: false, remaining: 0, retryAfterMs: Math.max(0, windowMs - (now - windowStart)) };
}

/** Bersihkan entri rate-limit yang sudah kedaluwarsa (dipanggil berkala). */
export async function purgeExpiredRateLimits(olderThanMs = 24 * 60 * 60 * 1000) {
  const cutoff = String(Date.now() - olderThanMs);
  await db.delete(rateLimits).where(and(sql`${rateLimits.windowStart} < ${cutoff}`));
}

/** Ambil IP klien dari header (best-effort di balik proxy). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}