"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { grammarLessonProgress } from "@/db/schema";
import { setLessonCompleted } from "@/db/queries/grammar";
import { addXp, completeUnit } from "@/db/queries/learning";

import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { XP_REWARDS } from "@/lib/xp";

export type BelajarState = { status: "idle" | "error"; message?: string };

/** Cek apakah lesson sudah pernah punya baris progres (pernah ditandai selesai). */
async function hasProgressRow(userId: number, lessonId: number) {
  const [row] = await db
    .select({ id: grammarLessonProgress.id })
    .from(grammarLessonProgress)
    .where(
      and(eq(grammarLessonProgress.userId, userId), eq(grammarLessonProgress.lessonId, lessonId)),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Tandai satu materi (lesson grammar) selesai dan beri XP sekali.
 * Mengulang materi tidak menghasilkan XP lagi.
 */
export async function markLessonDoneAction(lessonId: number): Promise<BelajarState> {
  const user = await requireUser();
  if (!Number.isInteger(lessonId)) {
    return { status: "error", message: "Materi tidak valid." };
  }

  const firstTime = !(await hasProgressRow(user.id, lessonId));
  await setLessonCompleted(user.id, lessonId, true);
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
