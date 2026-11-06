"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/db/queries/activity";
import { addXp } from "@/db/queries/learning";
import { reviewCard } from "@/db/queries/vocabulary";

import { requireUser } from "@/lib/session";
import { todayISO, type ReviewGrade } from "@/lib/srs";
import { XP_REWARDS } from "@/lib/xp";

export type ReviewState = { status: "idle" | "error"; message?: string };

/**
 * Ulangi satu kartu: update jadwal FSRS dan (untuk kartu baru yang benar)
 * beri XP sekali. Mengembalikan jadwal berikutnya untuk ditampilkan.
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

  // XP hanya untuk kartu yang pertama kali dikuasai (review pertama, jawab
  // benar). Penanda firstReview dihitung di statement UPDATE yang sama, jadi
  // dua review paralel tidak bisa sama-sama dapat XP.
  if (correct && next.firstReview) {
    await addXp(user.id, XP_REWARDS.vocabCard, "vocab", todayISO());
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
