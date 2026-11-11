"use server";

import { revalidatePath } from "next/cache";

import { lessonReadyToComplete, setLessonCompleted } from "@/db/queries/grammar";
import { addCappedXp, completeUnit, countUnitIncompleteLessons, getUnitById } from "@/db/queries/learning";

import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { XP_DAILY_CAPS, XP_REWARDS } from "@/lib/xp";

export type BelajarState = { status: "idle" | "error"; message?: string };

/**
 * Tandai satu materi (lesson grammar) selesai dan beri XP sekali.
 * Mengulang materi tidak menghasilkan XP lagi.
 * XP hanya diberikan kalau pengguna benar-benar mengerjakan latihannya
 * (minimal satu jawaban benar tercatat server-side) — melawan pemanggilan
 * action langsung untuk memanen XP (audit keamanan P1).
 */
export async function markLessonDoneAction(lessonId: number): Promise<BelajarState> {
  const user = await requireUser();
  if (!Number.isInteger(lessonId)) {
    return { status: "error", message: "Materi tidak valid." };
  }
  if (!(await lessonReadyToComplete(user.id, lessonId))) {
    return { status: "error", message: "Kerjakan dulu latihan materi ini, lalu tandai selesai." };
  }

  // Nilai kembalian true hanya untuk pemenang race insert atomik di
  // setLessonCompleted (onConflictDoNothing), jadi dua submit paralel tidak
  // bisa sama-sama dapat XP seperti saat pre-check hasProgressRow dulu.
  const firstTime = await setLessonCompleted(user.id, lessonId, true);
  if (firstTime) {
    await addCappedXp(user.id, "lesson", todayISO(), XP_REWARDS.grammarLesson, XP_DAILY_CAPS.lesson);
    revalidatePath("/belajar");
    revalidatePath("/materi");
  }
  return { status: "idle" };
}

/**
 * Selesaikan unit: catat progres unit + bonus XP (sekali). Syarat server-side:
 * unit ada dan terbit, dan semua materi grammar di unit sudah diselesaikan —
 * tanpa ini bonus 30 XP bisa dipanen untuk unit yang belum disentuh.
 */
export async function completeUnitAction(unitId: number): Promise<BelajarState> {
  const user = await requireUser();
  if (!Number.isInteger(unitId)) {
    return { status: "error", message: "Unit tidak valid." };
  }
  const unit = await getUnitById(unitId);
  if (!unit || !unit.published) {
    return { status: "error", message: "Unit tidak ditemukan." };
  }
  const incomplete = await countUnitIncompleteLessons(user.id, unitId);
  if (incomplete > 0) {
    return { status: "error", message: `Masih ada ${incomplete} materi di unit ini yang belum selesai.` };
  }

  const created = await completeUnit(user.id, unitId);
  if (created) {
    await addCappedXp(user.id, "unit", todayISO(), XP_REWARDS.unitComplete, XP_DAILY_CAPS.unit);
  }
  revalidatePath("/belajar");
  return { status: "idle" };
}
