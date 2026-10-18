import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { ttsCache } from "@/db/schema";
import type { ToeflQuestion } from "@/lib/toefl";
import { ttsVoice } from "@/lib/voices";

/** Batas waktu menyiapkan audio saat soal dibuat; sisanya diambil saat diputar. */
const WARM_BUDGET_MS = 20_000;

type Provider = "openrouter" | "kenari";

/** OpenRouter (Fish Audio) dipakai kalau kuncinya ada; kenari.id jadi cadangan. */
function pickProvider(): { provider: Provider; apiKey: string } | null {
  const openrouter = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouter && process.env.TTS_PROVIDER?.trim() !== "kenari") return { provider: "openrouter", apiKey: openrouter };
  const kenari = process.env.TTS_API_KEY?.trim();
  return kenari ? { provider: "kenari", apiKey: kenari } : null;
}

/** Fish Audio memakai ID suara (reference_id). Kosong = suara bawaan model. */
function fishVoice(voice: string) {
  const id = voice === "Charon" ? process.env.OPENROUTER_TTS_VOICE_MAN : process.env.OPENROUTER_TTS_VOICE_WOMAN;
  return id?.trim() || process.env.OPENROUTER_TTS_VOICE?.trim() || undefined;
}

function request(provider: Provider, apiKey: string, text: string, voice: string) {
  if (provider === "openrouter") {
    return fetch("https://openrouter.ai/api/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Title": "EnglishApp" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_TTS_MODEL?.trim() || "fish-audio/s2.1-pro-free:free",
        input: text,
        voice: fishVoice(voice),
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(40_000),
    });
  }
  return fetch(`${process.env.TTS_BASE_URL?.trim() || "https://kenari.id/v1"}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gemini-3-1-flash-tts", input: text, voice, response_format: "mp3" }),
    signal: AbortSignal.timeout(40_000),
  });
}

/** Audio mp3 dari cache, atau dibuat lewat penyedia suara lalu disimpan. Null kalau gagal/tidak dikonfigurasi. */
export async function getTts(text: string, voice: string): Promise<Buffer | null> {
  const picked = pickProvider();
  // Kunci cache memuat penyedia dan ID suara supaya ganti penyedia tidak memutar audio lama.
  const voiceKey = picked?.provider === "openrouter" ? (fishVoice(voice) ?? "default") : voice;
  const key = createHash("sha256").update(`${picked?.provider ?? "none"}
${voiceKey}
${text}`).digest("hex");
  const [hit] = await db.select().from(ttsCache).where(eq(ttsCache.key, key)).limit(1);
  if (hit) return Buffer.from(hit.audio, "base64");
  if (!picked) return null;

  let response: Response | null = null;
  for (let attempt = 0; attempt < 2 && !response?.ok; attempt += 1) {
    response = await request(picked.provider, picked.apiKey, text, voice).catch((error) => {
      console.error(`[tts] gagal menghubungi ${picked.provider}:`, error);
      return null;
    });
    if (response && !response.ok) {
      console.error(`[tts] ${picked.provider} status ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
      // Kunci salah atau saldo habis tidak akan membaik dengan mengulang.
      if ([401, 402, 403].includes(response.status)) break;
    }
  }
  if (!response?.ok) return null;
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) return null;
  await db.insert(ttsCache).values({ key, audio: audio.toString("base64") }).onConflictDoNothing();
  return audio;
}

/** Siapkan audio semua soal Listening (paralel) selama pembuatan soal, supaya langsung bunyi saat dimulai. */
export async function warmTts(questions: ToeflQuestion[]) {
  if (!pickProvider()) return;
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
