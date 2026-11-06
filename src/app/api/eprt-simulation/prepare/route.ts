import { NextResponse } from "next/server";

import { ensurePartBatch } from "@/lib/api/eprt-simulation";
import { AiError } from "@/lib/ai-client";
import { checkBudget } from "@/lib/ai-budget";
import { partBatches, SIM_PARTS } from "@/lib/eprt-simulation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";

export const maxDuration = 300;

// Menyiapkan satu batch kecil soal ({ id, index, batch }). Satu permintaan =
// satu batch supaya tiap permintaan pendek dan aman di batas durasi Vercel.
// Hasil tiap batch digabung ke satu sesi bagian yang utuh.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Satu simulasi penuh butuh ~10-20 batch; batas ini cukup longgar untuk
  // pemain sah dan menahan pemanggil borongan.
  const limit = await checkRateLimit(`eprt-prepare:user:${user.id}`, 40, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, message: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429 },
    );
  }
  // Cek di sini (bukan hanya di ask()) supaya sesi soal tidak dibuat dulu
  // lalu yatim ketika kuota sudah habis.
  const budget = await checkBudget();
  if (!budget.allowed) {
    return NextResponse.json(
      { ok: false, message: "Kuota AI harian habis. Coba lagi besok." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    index?: unknown;
    batch?: unknown;
  };
  const id = Number(body.id);
  const index = Number(body.index);
  const batch = Number(body.batch);
  const batches = SIM_PARTS[index] ? partBatches(SIM_PARTS[index]) : [];
  if (!Number.isInteger(id) || !Number.isInteger(index) || !Number.isInteger(batch) || !batches[batch]) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await ensurePartBatch(user.id, id, index, batch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof AiError ? error.message : "Gagal menyiapkan soal.";
    console.error("[eprt-simulation] prepare gagal:", error);
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
