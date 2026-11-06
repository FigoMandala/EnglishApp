"use server";

import { revalidatePath } from "next/cache";

import { getSpeakingBest, logActivity, setSpeakingBest } from "@/db/queries/activity";
import { addCappedXp } from "@/db/queries/learning";
import { requireUser } from "@/lib/session";
import { SPEAKING_PROMPTS } from "@/lib/speaking-prompts";
import { normalizeSpeakingBest, recordSpeakingScore } from "@/lib/speaking-scores";
import { todayISO } from "@/lib/srs";

/** Batas total XP dari mode latihan per hari, supaya liga dan streak tidak bisa dipompa. */
const DAILY_DRILL_XP_CAP = 120;

export type DrillKind = "listening" | "speaking" | "pairs";

/** XP per poin skor dan batas per sesi. Klien tidak dipercaya: semua dibatasi di server. */
const RULES: Record<DrillKind, { perPoint: number; cap: number; maxTotal: number; log: "vocab" | "chat"; label: string }> = {
  listening: { perPoint: 5, cap: 40, maxTotal: 10, log: "vocab", label: "Dengar & jawab" },
  speaking: { perPoint: 0.2, cap: 20, maxTotal: 100, log: "chat", label: "Ucapkan" },
  pairs: { perPoint: 4, cap: 40, maxTotal: 12, log: "vocab", label: "Cocokkan pasangan" },
};

export type DrillResult = { status: "idle" | "error"; xp?: number; message?: string };

/**
 * Catat satu sesi mode latihan bebas dan beri XP.
 * `score` = jumlah benar (listening, pairs) atau skor 0–100 (speaking).
 * `topicId` (opsional, hanya speaking) menyimpan skor terbaik per topik katalog.
 */
export async function finishDrillAction(
  kind: DrillKind,
  score: number,
  total: number,
  topicId?: string,
): Promise<DrillResult> {
  const user = await requireUser();
  // Server action menerima JSON bebas: kind bisa berupa string aneh seperti
  // "constructor" yang lolos lewat prototype. Cek keanggotaan key secara eksplisit.
  const rule = Object.prototype.hasOwnProperty.call(RULES, kind) ? RULES[kind] : undefined;
  if (!rule || !Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || total > rule.maxTotal) {
    return { status: "error", message: "Data sesi tidak valid." };
  }
  const clamped = Math.max(0, Math.min(score, kind === "speaking" ? 100 : total));
  const topic = kind === "speaking" && topicId ? SPEAKING_PROMPTS.find((prompt) => prompt.id === topicId) : undefined;
  const today = todayISO();

  // Cap harian dicek di dalam INSERT (atomik): submit paralel tidak bisa
  // menembus batas 120 XP/hari walau sama-sama membaca sisa kuota lama.
  const xp = await addCappedXp(
    user.id,
    "drill",
    today,
    Math.min(rule.cap, Math.round(clamped * rule.perPoint)),
    DAILY_DRILL_XP_CAP,
  );

  if (topic) {
    const stored = normalizeSpeakingBest(
      await getSpeakingBest(user.id),
      SPEAKING_PROMPTS.map((prompt) => prompt.id),
    );
    const next = recordSpeakingScore(stored, topic.id, clamped);
    if (next !== stored) await setSpeakingBest(user.id, next);
  }

  await logActivity(
    user.id,
    rule.log,
    `${rule.label}${topic ? ` · ${topic.topic}` : ""}: ${kind === "speaking" ? `skor ${clamped}` : `${clamped}/${total}`}`,
    today,
  );
  revalidatePath("/belajar");
  revalidatePath("/latihan");
  return { status: "idle", xp };
}
