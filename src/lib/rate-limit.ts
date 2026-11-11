import { and, eq, gt, lt, sql } from "drizzle-orm";

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
  // Sekitar 1% pemanggilan menyempatkan pembersihan entri kedaluwarsa supaya
  // tabel tidak tumbuh tanpa batas (fungsi purge dulunya tidak pernah dipanggil).
  if (Math.random() < 0.01) purgeExpiredRateLimits().catch(() => undefined);
  const now = Date.now();
  const nowStr = String(now);

  // 0) Fast-path: kalau jendela masih aktif dan kuota sudah habis, tolak
  // langsung dari satu SELECT. Tanpa ini setiap request yang diblokir tetap
  // menjalankan rantai 3 query di bawah — satu curl loop anonim berubah
  // menjadi amplifikasi 4 round-trip DB per request (audit keamanan P2).
  const [current] = await db
    .select({ count: rateLimits.count, windowStart: rateLimits.windowStart })
    .from(rateLimits)
    .where(eq(rateLimits.key, key))
    .limit(1);
  if (current && Number(current.count) >= limit && Number(current.windowStart) > now - windowMs) {
    return { ok: false, remaining: 0, retryAfterMs: Math.max(0, windowMs - (now - Number(current.windowStart))) };
  }

  // 1) Jendela masih berlaku dan masih ada sisa kuota: naikkan atomik.
  // Syarat windowStart mencegah jendela basi ikut dihitung (tanpanya kuota
  // menjadi kumulatif "N selamanya" sampai penuh, bukan "N per window").
  const bumped = await db
    .update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1`, updatedAt: sql`(datetime('now'))` })
    .where(
      and(
        eq(rateLimits.key, key),
        lt(rateLimits.count, limit),
        gt(rateLimits.windowStart, String(now - windowMs)),
      ),
    )
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

  // 3) Kalau langkah 2 gagal karena baris baru dibuat bersamaan oleh request
  // lain (upsert hanya menimpa window kedaluwarsa), coba naikkan hitungan
  // sekali lagi sebelum menolak — jangan langsung blok pemanggil pertama.
  const retried = await db
    .update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1`, updatedAt: sql`(datetime('now'))` })
    .where(
      and(
        eq(rateLimits.key, key),
        lt(rateLimits.count, limit),
        gt(rateLimits.windowStart, String(now - windowMs)),
      ),
    )
    .returning({ count: rateLimits.count });

  if (retried.length > 0) {
    const count = retried[0].count;
    return { ok: true, remaining: Math.max(0, limit - count), retryAfterMs: 0 };
  }

  // 4) Jendela masih aktif dan kuota habis: tolak.
  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const windowStart = Number(row?.windowStart) || now;
  return { ok: false, remaining: 0, retryAfterMs: Math.max(0, windowMs - (now - windowStart)) };
}

/**
 * Kembalikan satu hitungan kuota untuk key yang masih dalam window berlaku.
 * Dipakai saat panggilan mahal (AI) gagal sebelum benar-benar dipakai, supaya
 * "N per hari" tidak berubah menjadi "N percobaan per hari" saat provider
 * sedang gangguan. Tidak melakukan apa pun kalau window sudah ganti.
 */
export async function refundRateLimit(key: string, windowMs: number) {
  const now = Date.now();
  await db
    .update(rateLimits)
    .set({ count: sql`max(0, ${rateLimits.count} - 1)`, updatedAt: sql`(datetime('now'))` })
    .where(and(eq(rateLimits.key, key), gt(rateLimits.windowStart, String(now - windowMs))));
}

/** Bersihkan entri rate-limit yang sudah kedaluwarsa (dipanggil berkala). */
export async function purgeExpiredRateLimits(olderThanMs = 24 * 60 * 60 * 1000) {
  const cutoff = String(Date.now() - olderThanMs);
  await db.delete(rateLimits).where(and(sql`${rateLimits.windowStart} < ${cutoff}`));
}

/** Ambil IP klien dari header (best-effort di balik proxy). */
export function clientIp(headers: Headers): string {
  // x-vercel-forwarded-for ditulis edge Vercel (tepercaya); x-forwarded-for
  // mentah bisa dipalsukan user, jadi hanya jadi fallback terakhir.
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]?.trim() || "unknown";
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim() || "unknown";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}