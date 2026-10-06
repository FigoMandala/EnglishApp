import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { ttsCache } from "@/db/schema";
import type { ToeflQuestion } from "@/lib/toefl";
import { ttsVoice } from "@/lib/voices";

/** Batas waktu menyiapkan audio saat soal dibuat; sisanya diambil saat diputar. */
const WARM_BUDGET_MS = 20_000;

/** Audio mp3 dari cache, atau dibuat lewat kenari lalu disimpan. Null kalau gagal/tidak dikonfigurasi. */
export async function getTts(text: string, voice: string): Promise<Buffer | null> {
  const key = createHash("sha256").update(`${voice}
${text}`).digest("hex");
  const [hit] = await db.select().from(ttsCache).where(eq(ttsCache.key, key)).limit(1);
  if (hit) return Buffer.from(hit.audio, "base64");

  const apiKey = process.env.TTS_API_KEY?.trim();
  if (!apiKey) return null;
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2 && !response?.ok; attempt += 1) {
    response = await fetch(`${process.env.TTS_BASE_URL?.trim() || "https://kenari.id/v1"}/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gemini-3-1-flash-tts", input: text, voice, response_format: "mp3" }),
      signal: AbortSignal.timeout(40_000),
    }).catch((error) => {
      console.error("[tts] gagal menghubungi kenari:", error);
      return null;
    });
    if (response && !response.ok) console.error(`[tts] status ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
  }
  if (!response?.ok) return null;

  const audio = Buffer.from(await response.arrayBuffer());
  await db.insert(ttsCache).values({ key, audio: audio.toString("base64") }).onConflictDoNothing();
  return audio;
}

/** Siapkan audio semua soal Listening (paralel) selama pembuatan soal, supaya langsung bunyi saat dimulai. */
export async function warmTts(questions: ToeflQuestion[]) {
  if (!process.env.TTS_API_KEY?.trim()) return;
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
