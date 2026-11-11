import { NextResponse } from "next/server";

import type { LevelBand } from "@/db/queries/question-bank";
import { logAiUsage } from "@/db/queries/ai-usage";
import { setAiConcurrency } from "@/lib/ai-client";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { BANDS, createEprtContext, generateEprtBatch, KINDS, type Kind } from "@/lib/eprt-generate";
import { logAudit, verifyOrigin } from "@/lib/security";
import { getCurrentUser, isAdmin } from "@/lib/session";

export const maxDuration = 300;

/** Batas per request (paralel, muat di 300 dtk). Total yang lebih besar dipecah oleh klien jadi beberapa request. */
const MAX_PER_REQUEST = 5;

/** Generate soal EPrT sambil melaporkan progres: satu baris JSON (NDJSON) per batch yang selesai. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ message: "Khusus admin." }, { status: 403 });
  if (!(await verifyOrigin())) return NextResponse.json({ message: "Origin tidak valid." }, { status: 403 });

  const config = await getAiConfig();
  if (!aiConfigured(config)) return NextResponse.json({ message: "Isi key AI dulu di Pengaturan AI." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { kind?: string; band?: string; calls?: number; topic?: string };
  const kinds = body.kind === "all" ? KINDS : [body.kind as Kind];
  const band = body.band as LevelBand;
  if (!kinds.every((k) => KINDS.includes(k)) || !BANDS.includes(band)) {
    return NextResponse.json({ message: "Jenis atau level tidak dikenal." }, { status: 400 });
  }
  const calls = Math.min(MAX_PER_REQUEST, Math.max(1, Number(body.calls) || 1));
  const topic = String(body.topic ?? "").trim().slice(0, 100) || undefined;
  const jobs = kinds.flatMap((kind) => Array.from({ length: calls }, () => kind));

  // Jendela 3000 item terbaru per jenis: permintaan web tetap singkat; duplikat persis ditolak database.
  // Provider menolak (429) di atas ~15 permintaan serentak; batasi supaya semua batch tetap jalan (antre, bukan gagal).
  setAiConcurrency(8);
  const ctx = await createEprtContext(config, undefined, { recent: 3_000, kinds });
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: object) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      let done = 0;
      let added = 0;
      let dropped = 0;
      send({ type: "start", total: jobs.length });
      await Promise.all(
        jobs.map(async (kind) => {
          try {
            const result = await generateEprtBatch(ctx, kind, band, topic);
            added += result.n;
            dropped += result.dropped;
            done += 1;
            send({ type: "batch", kind, n: result.n, dropped: result.dropped, done, total: jobs.length });
          } catch (error) {
            done += 1;
            send({ type: "batch", kind, n: 0, dropped: 0, done, total: jobs.length, error: error instanceof Error ? error.message : "gagal" });
          }
        }),
      );
      // Belanja AI pembuat bank ikut tercatat di dashboard biaya (ctx.usage =
      // total seluruh panggilan provider lintas batch, termasuk verifikasi).
      await logAiUsage({
        userId: user.id,
        feature: "eptr",
        model: config.model,
        usage: ctx.usage,
        latencyMs: Date.now() - startedAt,
        ok: added > 0,
      }).catch(() => undefined);
      await logAudit({ actorId: user.id, action: "question.generate", detail: `eptr ${kinds.join("+")}/${band}: +${added}, ${dropped} dibuang` });
      send({ type: "end", added, dropped });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
