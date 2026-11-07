import webpush from "web-push";

import { listAllSubscriptionsForUserIds } from "@/db/queries/push";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";

/** Kunci publik untuk subscribe di sisi klien (aman dikirim ke browser). */
export const vapidPublicKey = PUBLIC_KEY;

export function pushConfigured() {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

export type PushPayload = { title: string; body: string; url: string };

/**
 * Kirim push ke seluruh langganan milik sekumpulan pengguna. Langganan yang
 * sudah mati (410/404 — user hapus izin atau browser baru) dihapus dari DB.
 * Kegagalan satu langganan tidak menggagalkan yang lain.
 */
export async function sendPushToUsers(
  userIds: number[],
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!pushConfigured() || userIds.length === 0) return { sent: 0, removed: 0 };

  webpush.setVapidDetails("mailto:admin@englishapp.example", PUBLIC_KEY, PRIVATE_KEY);
  const subscriptions = await listAllSubscriptionsForUserIds(userIds);
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const keys = JSON.parse(sub.keys) as { p256dh?: unknown; auth?: unknown };
        if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") throw new Error("keys rusak");
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          const { deletePushSubscriptionByEndpoint } = await import("@/db/queries/push");
          await deletePushSubscriptionByEndpoint(sub.endpoint);
          removed += 1;
        }
        // Selain 404/410: gagal sesaat (jaringan/provider) — biarkan langganannya.
      }
    }),
  );
  return { sent, removed };
}
