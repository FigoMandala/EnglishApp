import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { xpEvents } from "@/db/schema";
import { purgeOldLogs } from "@/db/queries/activity";
import { listSubscriptionUserIds } from "@/db/queries/push";
import { pushConfigured, sendPushToUsers } from "@/lib/push-server";
import { todayISO } from "@/lib/srs";

export const maxDuration = 60;

/** Ukuran satu batch pengingat harian; sisanya dilayani esok dengan rotasi. */
const MAX_TARGETS = 500;

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

  // Satu kegagalan DB tidak boleh mematikan seluruh run: Vercel Cron tidak
  // mengulang invokasi yang gagal (audit keamanan P3).
  try {
    const today = todayISO();
    const subscriberIds = await listSubscriptionUserIds();
    if (subscriberIds.length === 0) return Response.json({ ok: true, sent: 0, targets: 0 });

    // Yang sudah belajar hari ini (punya xp_events bertanggal hari ini) tidak
    // diganggu. inArray dipecah per chunk agar tidak menabrak batas parameter
    // bound SQLite saat pelanggan banyak.
    const studiedIds = new Set<number>();
    for (let i = 0; i < subscriberIds.length; i += 400) {
      const chunk = subscriberIds.slice(i, i + 400);
      const studied = await db
        .selectDistinct({ userId: xpEvents.userId })
        .from(xpEvents)
        .where(and(eq(xpEvents.date, today), inArray(xpEvents.userId, chunk)));
      for (const row of studied) studiedIds.add(row.userId);
    }

    // Rotasi harian: pool > MAX_TARGETS tidak lagi selalu memotong pengguna
    // terbaru secara diam-diam — titik mulai digeser tiap hari sehingga semua
    // kelompok kebagian giliran.
    const eligible = subscriberIds.filter((id) => !studiedIds.has(id));
    let targets = eligible;
    if (eligible.length > MAX_TARGETS) {
      const dayIndex = Math.floor(Date.now() / 86_400_000);
      const start = (dayIndex * MAX_TARGETS) % eligible.length;
      targets = [...eligible.slice(start), ...eligible.slice(0, start)].slice(0, MAX_TARGETS);
    }

    const { sent, removed } = await sendPushToUsers(targets, {
      title: "Lori kangen nih 👀",
      body: "Hari ini belum belajar — satu sesi 3 menit cukup untuk amankan harimu!",
      url: "/kosakata/review",
    });

    // Sekalian: buang log lebih tua dari 90 hari (gagal diabaikan — bukan
    // tugas utama run ini).
    await purgeOldLogs(90).catch(() => undefined);

    return Response.json({ ok: true, subscribers: subscriberIds.length, targets: targets.length, sent, removed });
  } catch (error) {
    console.error("[cron] push gagal:", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "gagal" });
  }
}
