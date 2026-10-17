import { NextResponse } from "next/server";

import { ensurePartBatch } from "@/lib/api/eprt-simulation";
import { AiError } from "@/lib/ai-client";
import { partBatches, SIM_PARTS } from "@/lib/eprt-simulation";
import { getCurrentUser } from "@/lib/session";

export const maxDuration = 300;

// Menyiapkan satu batch kecil soal ({ id, index, batch }). Satu permintaan =
// satu batch supaya tiap permintaan pendek dan aman di batas durasi Vercel.
// Hasil tiap batch digabung ke satu sesi bagian yang utuh.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

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
