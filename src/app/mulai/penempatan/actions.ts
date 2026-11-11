"use server";

import { normalizeAnswer } from "@/lib/grammar-exercise";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { headers } from "next/headers";

import { placementKeyTexts } from "@/db/queries/onboarding";

export type PlacementCheckResult = { ok: boolean; keys: string[] };

/**
 * Periksa satu jawaban tes penempatan dari sisi server. Kunci jawaban tidak
 * pernah ikut payload halaman (publik, tanpa login) — kunci baru dikirim
 * setelah pengguna memeriksa soal itu, dan tetap dibatasi rate limit per IP.
 */
export async function checkPlacementAnswerAction(id: number, choice: string | null): Promise<PlacementCheckResult> {
  const ip = clientIp(await headers());
  const limit = await checkRateLimit(`placement:ip:${ip}`, 120, 10 * 60_000);
  if (!limit.ok) return { ok: false, keys: [] };

  const keys = await placementKeyTexts(id);
  if (keys.length === 0) return { ok: false, keys: [] };

  const ok =
    typeof choice === "string" &&
    normalizeAnswer(choice) !== "" &&
    keys.some((key) => normalizeAnswer(key) === normalizeAnswer(choice));
  return { ok, keys };
}
