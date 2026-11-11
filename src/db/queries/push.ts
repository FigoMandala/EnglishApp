import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

/** Maks langganan yang dikirim per pengguna dalam satu run massal. */
const MAX_SUBSCRIPTIONS_PER_USER = 5;

/**
 * Simpan (atau perbarui) langganan push untuk satu endpoint unik.
 * Upsert hanya menyentuh baris milik pengguna yang sama — endpoint milik
 * orang lain tidak boleh "diadopsi" hanya karena diketahui (audit keamanan P3).
 */
export async function savePushSubscription(userId: number, endpoint: string, keys: string) {
  const [row] = await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, keys })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, keys, createdAt: sql`(datetime('now'))` },
      where: eq(pushSubscriptions.userId, userId),
    })
    .returning();
  return row ?? null;
}

export async function deletePushSubscription(userId: number, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function listPushSubscriptions(userId: number) {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/**
 * Ambil langganan milik sekumpulan pengguna (untuk pengiriman massal),
 * dibatasi beberapa langganan per pengguna supaya akun dengan ribuan
 * endpoint tidak menggembungkan fan-out cron (audit keamanan P2).
 */
export async function listAllSubscriptionsForUserIds(userIds: number[]) {
  if (userIds.length === 0) return [];
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds))
    .orderBy(asc(pushSubscriptions.id));
  const seen = new Map<number, number>();
  return rows.filter((row) => {
    const count = seen.get(row.userId) ?? 0;
    if (count >= MAX_SUBSCRIPTIONS_PER_USER) return false;
    seen.set(row.userId, count + 1);
    return true;
  });
}

/** Id semua pengguna yang punya langganan aktif (target cron pengingat), urut stabil untuk rotasi. */
export async function listSubscriptionUserIds() {
  const rows = await db
    .selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .orderBy(asc(pushSubscriptions.userId));
  return rows.map((row) => row.userId);
}

/** Hapus langganan berdasarkan endpoint (dipakai saat push menjawab 404/410). */
export async function deletePushSubscriptionByEndpoint(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
