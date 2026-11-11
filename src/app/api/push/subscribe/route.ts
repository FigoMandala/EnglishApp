import { savePushSubscription } from "@/db/queries/push";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

/** Batas panjang nilai langganan push (mencegah baris DB raksasa — audit keamanan P2). */
const MAX_ENDPOINT_LENGTH = 500;
const MAX_KEY_LENGTH = 256;

/**
 * Layanan push peramban yang dikenal. Endpoint di luar daftar ini ditolak:
 * server akan POST langsung ke endpoint tersimpan saat cron, jadi host
 * arbitrer berubah menjadi relay egress atas nama aplikasi (audit P2).
 */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com", // Chrome/Edge/Android
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari
] as const;

function isKnownPushService(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && (PUSH_SERVICE_HOSTS as readonly string[]).includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Simpan (atau perbarui) langganan push milik pengguna yang sedang login. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: "Belum masuk." }, { status: 401 });

  const limit = await checkRateLimit(`push-sub:user:${user.id}`, 20, 60 * 60_000);
  if (!limit.ok) return Response.json({ ok: false, message: "Terlalu banyak permintaan." }, { status: 429 });

  // Tolak body raksasa sebelum di-parse (batas proxy Vercel 4,5 MB; berjaga
  // untuk hosting mandiri lewat output standalone).
  if (Number(request.headers.get("content-length") ?? 0) > 8_192) {
    return Response.json({ ok: false, message: "Langganan tidak valid." }, { status: 413 });
  }

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
    keys?: unknown;
  } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const keys = body?.keys as { p256dh?: unknown; auth?: unknown } | null | undefined;
  if (
    !endpoint ||
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    !isKnownPushService(endpoint) ||
    !keys ||
    typeof keys.p256dh !== "string" ||
    typeof keys.auth !== "string" ||
    keys.p256dh.length > MAX_KEY_LENGTH ||
    keys.auth.length > MAX_KEY_LENGTH
  ) {
    return Response.json({ ok: false, message: "Langganan tidak valid." }, { status: 400 });
  }

  await savePushSubscription(user.id, endpoint, JSON.stringify({ p256dh: keys.p256dh, auth: keys.auth }));
  return Response.json({ ok: true });
}
