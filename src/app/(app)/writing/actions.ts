"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/db/queries/activity";
import { createWritingSubmission } from "@/db/queries/writing";
import { analyzeEssay } from "@/lib/api/writing";
import { AiError } from "@/lib/ai-client";
import { guardUserInput } from "@/lib/moderation";
import { validateEssay, wordCount } from "@/lib/writing";
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
