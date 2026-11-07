import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { xpEvents } from "@/db/schema";
import { listSubscriptionUserIds } from "@/db/queries/push";
import { pushConfigured, sendPushToUsers } from "@/lib/push-server";
import { todayISO } from "@/lib/srs";

/**
 * Cron harian (Vercel Cron): kirim satu pengingat ke pengguna yang punya
 * langganan push tapi belum mendapat XP hari ini. Dilindungi CRON_SECRET —
 * Vercel Cron otomatis mengirim header `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!pushConfigured()) {
    return Response.json({ ok: true, skipped: "VAPID belum dikonfigurasi" });
  }

  const today = todayISO();
  const subscriberIds = await listSubscriptionUserIds();
  if (subscriberIds.length === 0) return Response.json({ ok: true, sent: 0, targets: 0 });

  // Yang sudah belajar hari ini (punya xp_events bertanggal hari ini) tidak diganggu.
  const studied = await db
    .selectDistinct({ userId: xpEvents.userId })
    .from(xpEvents)
    .where(and(eq(xpEvents.date, today), inArray(xpEvents.userId, subscriberIds)));
  const studiedIds = new Set(studied.map((row) => row.userId));
  const targets = subscriberIds.filter((id) => !studiedIds.has(id)).slice(0, 500);

  const { sent, removed } = await sendPushToUsers(targets, {
    title: "Lori kangen nih 👀",
    body: "Hari ini belum belajar — satu sesi 3 menit cukup untuk amankan harimu!",
    url: "/kosakata/review",
  });
  return Response.json({ ok: true, subscribers: subscriberIds.length, targets: targets.length, sent, removed });
}
