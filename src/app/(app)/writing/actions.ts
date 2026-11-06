"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { writingSubmissions } from "@/db/schema";
import { logActivity } from "@/db/queries/activity";
import { addCappedXp } from "@/db/queries/learning";
import {
  PARAGRAPH_MAX_WORDS,
  PARAGRAPH_MIN_WORDS,
  validateEssay,
  validateParagraph,
  wordCount,
  type WritingScore,
} from "@/lib/writing";
import { analyzeEssay, reviewParagraph } from "@/lib/api/writing";
import { AiError } from "@/lib/ai-client";
import { guardUserInput } from "@/lib/moderation";
import { checkRateLimit, refundRateLimit } from "@/lib/rate-limit";
import { createWritingSubmission } from "@/db/queries/writing";
import { todayISO } from "@/lib/srs";

import { requireUser } from "@/lib/session";

export type WritingState = { status: "idle" | "error"; message?: string };

/** Batas penilaian AI per user per hari (esai berat, paragraf ringan). */
const ESSAY_DAILY_LIMIT = 20;
const PARAGRAPH_REVIEW_DAILY_LIMIT = 60;

async function enforceAiDailyLimit(key: string, limit: number, label: string) {
  const limitCheck = await checkRateLimit(key, limit, 24 * 60 * 60 * 1000);
  if (!limitCheck.ok) {
    return {
      status: "error" as const,
      message: `Kuota ${label} untuk hari ini sudah habis (maks ${limit}). Coba lagi besok ya.`,
    };
  }
  return null;
}

export async function submitEssayAction(
  _prev: WritingState,
  formData: FormData,
): Promise<WritingState> {
  const user = await requireUser();
  const prompt = String(formData.get("prompt") ?? "").trim().slice(0, 300);
  const essay = String(formData.get("essay") ?? "");

  const invalid = validateEssay(essay);
  if (invalid) return { status: "error", message: invalid };

  const essayLimitKey = `writing:essay:user:${user.id}`;
  const dailyLimit = await enforceAiDailyLimit(essayLimitKey, ESSAY_DAILY_LIMIT, "penilaian esai");
  if (dailyLimit) return dailyLimit;

  const moderation = await guardUserInput(essay, "writing", user.id);
  if (!moderation.allowed) {
    return { status: "error", message: "Esaimu tidak bisa dinilai. Tulis ulang dengan bahasa yang santun ya." };
  }

  let total = 0;
  try {
    const score = await analyzeEssay(user.id, prompt, essay);
    const row = await createWritingSubmission({
      userId: user.id,
      prompt,
      essay,
      wordCount: wordCount(essay),
      feedback: JSON.stringify(score),
      total: score.total,
    });
    total = score.total;
    await logActivity(user.id, "writing", `Esai skor ${total}`, todayISO());
    revalidatePath("/writing");
    return { status: "idle", message: String(row.id) };
  } catch (error) {
    // Panggilan AI gagal: kembalikan slot kuota supaya gangguan provider tidak
    // mengubah "20 esai per hari" menjadi "20 percobaan per hari".
    await refundRateLimit(essayLimitKey, 24 * 60 * 60 * 1000).catch(() => undefined);
    return {
      status: "error",
      message: error instanceof AiError ? error.message : "Penilaian esai sedang bermasalah.",
    };
  }
}

export type ParagraphState =
  | { status: "done"; score: WritingScore }
  | { status: "idle" | "error"; message?: string };

export type ParagraphInput = { prompt: string; outline: string; paragraph: string };

/** Koreksi paragraf kilat. Tidak disimpan ke database, jadi tidak mengotori riwayat esai. */
export async function reviewParagraphAction(input: ParagraphInput): Promise<ParagraphState> {
  const user = await requireUser();
  const prompt = String(input.prompt ?? "").trim().slice(0, 300);
  const outline = String(input.outline ?? "").trim().slice(0, 800);
  const paragraph = String(input.paragraph ?? "");

  const invalid = validateParagraph(paragraph);
  if (invalid) return { status: "error", message: invalid };

  const paragraphLimitKey = `writing:paragraph:user:${user.id}`;
  const dailyLimit = await enforceAiDailyLimit(
    paragraphLimitKey,
    PARAGRAPH_REVIEW_DAILY_LIMIT,
    "koreksi paragraf",
  );
  if (dailyLimit) return dailyLimit;

  const moderation = await guardUserInput(paragraph, "writing", user.id);
  if (!moderation.allowed) {
    return { status: "error", message: "Paragrafmu tidak bisa dinilai. Tulis ulang dengan bahasa yang santun ya." };
  }

  try {
    const score = await reviewParagraph(user.id, { prompt, outline, paragraph });
    return { status: "done", score };
  } catch (error) {
    // Panggilan AI gagal: kembalikan slot kuota harian.
    await refundRateLimit(paragraphLimitKey, 24 * 60 * 60 * 1000).catch(() => undefined);
    return {
      status: "error",
      message: error instanceof AiError ? error.message : "Koreksi paragraf sedang bermasalah.",
    };
  }
}

/** Batas XP paragraf kilat per hari, supaya bisa jadi kebiasaan tanpa bisa dipompa. */
const PARAGRAPH_XP_DAILY_CAP = 60;

/** XP per poin skor dan batas per paragraf. */
const PARAGRAPH_XP_PER_POINT = 0.25;
const PARAGRAPH_XP_PER_RUN = 25;

export type ParagraphXp = { status: "idle" | "error"; xp?: number; message?: string };

/**
 * Catat satu latihan paragraf: XP harian + entri aktivitas (biar streak dan
 * kalender belajar ikut jalan). Isi paragrafnya sendiri tidak disimpan, jadi
 * riwayat esai dan statistik topik tetap bersih.
 */
export async function finishParagraphAction(score: number, words: number): Promise<ParagraphXp> {
  const user = await requireUser();
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return { status: "error", message: "Skor paragraf tidak valid." };
  }
  if (!Number.isInteger(words) || words < PARAGRAPH_MIN_WORDS || words > PARAGRAPH_MAX_WORDS) {
    return { status: "error", message: "Panjang paragraf tidak valid." };
  }

  const today = todayISO();

  // Cap harian dicek di dalam INSERT (atomik): submit paralel tidak bisa
  // menembus batas 60 XP/hari paragraf.
  const xp = await addCappedXp(
    user.id,
    "paragraph",
    today,
    Math.min(PARAGRAPH_XP_PER_RUN, Math.round(score * PARAGRAPH_XP_PER_POINT)),
    PARAGRAPH_XP_DAILY_CAP,
  );
  await logActivity(user.id, "writing", `Paragraf kilat: skor ${score}`, today);
  revalidatePath("/belajar");
  revalidatePath("/writing");
  return { status: "idle", xp };
}

export async function deleteEssayAction(id: number): Promise<WritingState> {
  const user = await requireUser();
  if (!Number.isInteger(id)) return { status: "error", message: "Esai tidak valid." };

  await db
    .delete(writingSubmissions)
    .where(and(eq(writingSubmissions.id, id), eq(writingSubmissions.userId, user.id)));
  revalidatePath("/writing");
  return { status: "idle" };
}
