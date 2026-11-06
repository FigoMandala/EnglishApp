"use server";

import { revalidatePath } from "next/cache";

import { setLessonCompleted } from "@/db/queries/grammar";
import { addXp, completeUnit } from "@/db/queries/learning";

import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { XP_REWARDS } from "@/lib/xp";

export type BelajarState = { status: "idle" | "error"; message?: string };

/**
 * Tandai satu materi (lesson grammar) selesai dan beri XP sekali.
 * Mengulang materi tidak menghasilkan XP lagi.
 */
export async function markLessonDoneAction(lessonId: number): Promise<BelajarState> {
  const user = await requireUser();
  if (!Number.isInteger(lessonId)) {
    return { status: "error", message: "Materi tidak valid." };
  }

  // Nilai kembalian true hanya untuk pemenang race insert atomik di
  // setLessonCompleted (onConflictDoNothing), jadi dua submit paralel tidak
  // bisa sama-sama dapat XP seperti saat pre-check hasProgressRow dulu.
  const firstTime = await setLessonCompleted(user.id, lessonId, true);
  if (firstTime) {
    await addXp(user.id, XP_REWARDS.grammarLesson, "lesson", todayISO());
    revalidatePath("/belajar");
    revalidatePath("/materi");
  }
  return { status: "idle" };
}

/** Selesaikan unit: catat progres unit + bonus XP (sekali). */
export async function completeUnitAction(unitId: number): Promise<BelajarState> {
  const user = await requireUser();
  if (!Number.isInteger(unitId)) {
    return { status: "error", message: "Unit tidak valid." };
  }

  const created = await completeUnit(user.id, unitId);
  if (created) {
    await addXp(user.id, XP_REWARDS.unitComplete, "unit", todayISO());
  }
  revalidatePath("/belajar");
  return { status: "idle" };
}
