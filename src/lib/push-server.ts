import webpush from "web-push";

import { listAllSubscriptionsForUserIds } from "@/db/queries/push";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";

/** Alamat kontak ke layanan push (ditimpa lewat env VAPID_SUBJECT bila perlu). */
const VAPID_SUBJECT = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@englishapp.example";

/** Kunci publik untuk subscribe di sisi klien (aman dikirim ke browser). */
export const vapidPublicKey = PUBLIC_KEY;

export function pushConfigured() {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

export type PushPayload = { title: string; body: string; url: string };

/** Kirim paralel terbatas: tanpa ini, 10 ribu endpoint milik satu akun iseng membuka ribuan TLS serentak dan menggantung lambda (audit keamanan P2). */
const CONCURRENCY = 10;
/** web-push tanpa opsi timeout tidak pernah menyerah pada endpoint black-hole. */
const SEND_TIMEOUT_MS = 10_000;

/** Kegagalan permanen layanan push: langganannya mati, tidak ada gunanya dicoba ulang tiap hari. */
const DEAD_STATUS = new Set([400, 401, 403, 404, 410]);

/**
 * Kirim push ke seluruh langganan milik sekumpulan pengguna. Langganan yang
 * sudah mati (410/404 — user hapus izin atau browser baru; juga 400/401/403
 * yang tidak akan pernah sembuh) dihapus dari DB. Kegagalan satu langganan
 * tidak menggagalkan yang lain — pembersihan DB yang gagal pun tidak.
 */
export async function sendPushToUsers(
  userIds: number[],
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!pushConfigured() || userIds.length === 0) return { sent: 0, removed: 0 };

  webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  const subscriptions = await listAllSubscriptionsForUserIds(userIds);
  let sent = 0;
  let removed = 0;

  // Kolam pekerja sederhana: paling banyak CONCURRENCY pengiriman berjalan
  // bersamaan, sisanya antre.
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, subscriptions.length) }, async () => {
    while (next < subscriptions.length) {
      const sub = subscriptions[next];
      next += 1;
      try {
        const keys = JSON.parse(sub.keys) as { p256dh?: unknown; auth?: unknown };
        if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") throw new Error("keys rusak");
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
          JSON.stringify(payload),
          { timeout: SEND_TIMEOUT_MS },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (typeof status === "number" && DEAD_STATUS.has(status)) {
          try {
            const { deletePushSubscriptionByEndpoint } = await import("@/db/queries/push");
            await deletePushSubscriptionByEndpoint(sub.endpoint);
            removed += 1;
          } catch {
            // Gagal hapus satu baris tidak boleh membatalkan sisa pengiriman
            // (dulunya melempar dari dalam catch dan mematikan seluruh run cron).
          }
        }
        // Selain itu: gagal sesaat (jaringan/provider) — biarkan langganannya.
      }
    }
  });
  await Promise.all(workers);
  return { sent, removed };
}
