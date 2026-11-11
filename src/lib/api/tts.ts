import { createHash } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { ttsCache } from "@/db/schema";
import type { ToeflQuestion } from "@/lib/toefl";
import { ttsVoice } from "@/lib/voices";

/** Batas waktu menyiapkan audio saat soal dibuat; sisanya diambil saat diputar. */
const WARM_BUDGET_MS = 20_000;

/** Audio lebih besar dari ini tidak masuk cache DB (audio normal jauh di bawah ini). */
const MAX_CACHE_BYTES = 2_000_000;

const apiKey = () => process.env.FISH_AUDIO_API_KEY?.trim();

const ttsModel = () => process.env.FISH_AUDIO_MODEL?.trim() || "s2.1-pro-free";

/** 64 kbps cukup untuk ucapan dan separuh ukuran 128 kbps (cache audio disimpan base64 di database). */
const MP3_BITRATE = 64;

/** Fish Audio memilih suara lewat reference_id; kosong = suara bawaan model. Kore = wanita, Charon = pria. */
function modelVoice(voice: string) {
  const id = voice === "Charon" ? process.env.FISH_VOICE_MAN : process.env.FISH_VOICE_WOMAN;
  return id?.trim() || undefined;
}

function request(key: string, text: string, voice: string) {
  return fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, model: ttsModel() },
    body: JSON.stringify({ text, format: "mp3", mp3_bitrate: MP3_BITRATE, reference_id: modelVoice(voice) }),
    signal: AbortSignal.timeout(40_000),
  });
}

/** Audio mp3 dari cache, atau dibuat lewat Fish Audio lalu disimpan. Null kalau gagal/tidak dikonfigurasi. */
export async function getTts(text: string, voice: string): Promise<Buffer | null> {
  const apiKeyValue = apiKey();
  // Kunci cache memuat model dan suara supaya ganti model tidak memutar audio lama.
  const key = createHash("sha256").update(`fish64
${ttsModel()}:${modelVoice(voice) ?? "default"}
${text}`).digest("hex");
  const [hit] = await db.select().from(ttsCache).where(eq(ttsCache.key, key)).limit(1);
  if (hit) return Buffer.from(hit.audio, "base64");
  if (!apiKeyValue) return null;

  let response: Response | null = null;
  for (let attempt = 0; attempt < 2 && !response?.ok; attempt += 1) {
    response = await request(apiKeyValue, text, voice).catch((error) => {
      console.error("[tts] gagal menghubungi Fish Audio:", error);
      return null;
    });
    if (response && !response.ok) {
      console.error(`[tts] Fish Audio status ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
      // Kunci salah, saldo habis atau kuota harian habis tidak akan membaik dengan mengulang.
      if ([401, 402, 403, 429].includes(response.status)) break;
    }
  }
  if (!response?.ok) return null;
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) return null;
  if (audio.length <= MAX_CACHE_BYTES) {
    await db.insert(ttsCache).values({ key, audio: audio.toString("base64") }).onConflictDoNothing();
    // Sekitar 2% simpanan memicu pembersihan cache >30 hari supaya tabel
    // audio base64 tidak menggembungkan database tanpa batas.
    if (Math.random() < 0.02) {
      await db
        .run(sql`delete from tts_cache where created_at < datetime('now', '-30 days')`)
        .catch(() => undefined);
    }
  }
  return audio;
}

/** Siapkan audio semua soal Listening (paralel) selama pembuatan soal, supaya langsung bunyi saat dimulai. */
export async function warmTts(questions: ToeflQuestion[]) {
  if (!apiKey()) return;
  const lines = new Map<string, { text: string; voice: string }>();
  for (const question of questions) {
    if (!question.audio) continue;
    for (const line of [...question.audio, { speaker: "man", text: question.q }]) {
      const voice = ttsVoice(line.speaker);
      lines.set(`${voice}
${line.text}`, { text: line.text, voice });
    }
  }
  if (!lines.size) return;
  const work = Promise.allSettled([...lines.values()].map((line) => getTts(line.text, line.voice)));
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, WARM_BUDGET_MS))]);
}
