"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/db/queries/activity";
import { addCappedXp } from "@/db/queries/learning";
import { reviewCard } from "@/db/queries/vocabulary";

import { requireUser } from "@/lib/session";
import { todayISO, type ReviewGrade } from "@/lib/srs";
import { XP_REWARDS } from "@/lib/xp";

export type ReviewState = { status: "idle" | "error"; message?: string };

/** Batas XP review per hari: sesi terbesar (60 kartu) x XP per kartu benar. */
const VOCAB_REVIEW_DAILY_XP_CAP = 180;

/**
 * Ulangi satu kartu: update jadwal FSRS dan beri XP untuk jawaban benar.
 * Mengembalikan jadwal berikutnya untuk ditampilkan.
 */
export async function reviewCardAction(
  vocabularyId: number,
  correct: boolean,
  grade?: ReviewGrade,
): Promise<{ status: "idle" | "error"; dueAt?: string; box?: number; message?: string }> {
  const user = await requireUser();
  if (!Number.isInteger(vocabularyId)) {
    return { status: "error", message: "Kartu tidak valid." };
  }

  const safeGrade: ReviewGrade = grade === "hard" || grade === "easy" ? grade : "good";
  const next = await reviewCard(user.id, vocabularyId, correct, safeGrade);

  // Setiap kartu benar diberi XP (cap harian dicek di dalam INSERT) — sesuai
  // janji UI "+3 XP per kartu", dan sekaligus menandai hari ini sebagai hari
  // belajar untuk streak (studiedDates dibaca dari xp_events). Dulu XP hanya
  // untuk review pertama sebuah kartu, sehingga sesi kartu due tidak pernah
  // menggerakkan XP maupun streak padahal UI menampilkannya.
  if (correct) {
    await addCappedXp(user.id, "vocab", todayISO(), XP_REWARDS.vocabCard, VOCAB_REVIEW_DAILY_XP_CAP);
    revalidatePath("/kosakata");
    revalidatePath("/belajar");
  }
  return { status: "idle", dueAt: next.dueAt, box: next.box };
}

/** Catat satu sesi review selesai (untuk streak & statistik harian). */
export async function logVocabSessionAction(correctCount: number, totalCount: number): Promise<ReviewState> {
  const user = await requireUser();
  if (!Number.isInteger(correctCount) || !Number.isInteger(totalCount) || totalCount <= 0) {
    return { status: "error", message: "Data sesi tidak valid." };
  }
  if (correctCount > totalCount) correctCount = totalCount;

  await logActivity(
    user.id,
    "vocab",
    `Review ${totalCount} kartu, ${correctCount} benar`,
    todayISO(),
  );
  return { status: "idle" };
}
