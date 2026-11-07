import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

/** Simpan (atau perbarui) langganan push untuk satu endpoint unik. */
export async function savePushSubscription(userId: number, endpoint: string, keys: string) {
  const [row] = await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, keys })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, keys, createdAt: sql`(datetime('now'))` },
    })
    .returning();
  return row;
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

/** Ambil semua langganan milik sekumpulan pengguna (untuk pengiriman massal). */
export async function listAllSubscriptionsForUserIds(userIds: number[]) {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));
}

/** Id semua pengguna yang punya langganan aktif (target cron pengingat). */
export async function listSubscriptionUserIds() {
  const rows = await db.selectDistinct({ userId: pushSubscriptions.userId }).from(pushSubscriptions);
  return rows.map((row) => row.userId);
}

/** Hapus langganan berdasarkan endpoint (dipakai saat push menjawab 404/410). */
export async function deletePushSubscriptionByEndpoint(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}