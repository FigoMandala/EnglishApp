"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { xpEvents } from "@/db/schema";
import { logActivity } from "@/db/queries/activity";
import { addXp } from "@/db/queries/learning";
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
import { createWritingSubmission } from "@/db/queries/writing";
import { todayISO } from "@/lib/srs";

import { requireUser } from "@/lib/session";

export type WritingState = { status: "idle" | "error"; message?: string };

export async function submitEssayAction(
  _prev: WritingState,
  formData: FormData,
): Promise<WritingState> {
  const user = await requireUser();
  const prompt = String(formData.get("prompt") ?? "").trim().slice(0, 300);
  const essay = String(formData.get("essay") ?? "");

  const invalid = validateEssay(essay);
  if (invalid) return { status: "error", message: invalid };

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

  const moderation = await guardUserInput(paragraph, "writing", user.id);
  if (!moderation.allowed) {
    return { status: "error", message: "Paragrafmu tidak bisa dinilai. Tulis ulang dengan bahasa yang santun ya." };
  }

  try {
    const score = await reviewParagraph(user.id, { prompt, outline, paragraph });
    return { status: "done", score };
  } catch (error) {
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
  const [earned] = await db
    .select({ n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, user.id),
        eq(xpEvents.reason, "paragraph"),
        eq(xpEvents.date, today),
      ),
    );
  const room = Math.max(0, PARAGRAPH_XP_DAILY_CAP - Number(earned?.n ?? 0));
  const xp = Math.min(PARAGRAPH_XP_PER_RUN, room, Math.round(score * PARAGRAPH_XP_PER_POINT));

  if (xp > 0) await addXp(user.id, xp, "paragraph", today);
  await logActivity(user.id, "writing", `Paragraf kilat: skor ${score}`, today);
  revalidatePath("/belajar");
  revalidatePath("/writing");
  return { status: "idle", xp };
}

export async function deleteEssayAction(id: number): Promise<WritingState> {
  const user = await requireUser();
  if (!Number.isInteger(id)) return { status: "error", message: "Esai tidak valid." };

  const { db } = await import("@/db");
  const { writingSubmissions } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  await db.delete(writingSubmissions).where(and(eq(writingSubmissions.id, id), eq(writingSubmissions.userId, user.id)));
  revalidatePath("/writing");
  return { status: "idle" };
}
