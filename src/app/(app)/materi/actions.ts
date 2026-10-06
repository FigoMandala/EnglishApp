"use server";

import { revalidatePath } from "next/cache";

import { addXp } from "@/db/queries/learning";
import { getExerciseById, recordAttempt } from "@/db/queries/grammar-exercises";
import { checkSentence } from "@/lib/api/sentence";
import { checkAnswer, parseAnswers, validateAnswerText } from "@/lib/grammar-exercise";
import { logActivity } from "@/db/queries/activity";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { XP_REWARDS } from "@/lib/xp";
import { AiError } from "@/lib/ai-client";

export type MateriState = { status: "idle" | "error"; message?: string };

export type SubmitResult =
  | { status: "idle"; correct: boolean; explanation: string | null; firstCorrect: boolean }
  | { status: "error"; message: string };

/**
 * Jawab satu soal latihan. Penilaian lokal (pasti & gratis); untuk soal compose,
 * kalimat diperiksa AI lalu dinilai berdasarkan ok/corrected.
 */
export async function submitExerciseAction(
  exerciseId: number,
  answer: string,
): Promise<SubmitResult> {
  const user = await requireUser();
  if (!Number.isInteger(exerciseId)) {
    return { status: "error", message: "Soal tidak valid." };
  }
  const textError = validateAnswerText(answer);
  if (textError) return { status: "error", message: textError };

  const exercise = await getExerciseById(exerciseId);
  if (!exercise) return { status: "error", message: "Soal tidak ditemukan." };

  const keys = parseAnswers(exercise.answers);
  let correct = false;
  let explanation: string | null = exercise.explanation ?? null;

  if (exercise.type === "compose") {
    // Compose dinilai AI: ok=true berarti kalimat sudah benar.
    try {
      const feedback = await checkSentence(user.id, null, answer);
      correct = feedback.ok;
      explanation = [
        feedback.praise,
        ...feedback.notes,
        feedback.ok ? `Benar: ${feedback.corrected}` : `Perbaikan: ${feedback.corrected}`,
      ]
        .filter(Boolean)
        .join(" · ");
    } catch (error) {
      const message = error instanceof AiError ? error.message : "Koreksi AI sedang bermasalah.";
      return { status: "error", message };
    }
  } else {
    correct = checkAnswer(exercise.type, answer, keys);
  }

  const { firstCorrect } = await recordAttempt(user.id, exerciseId, answer, correct);
  if (firstCorrect) {
    await addXp(user.id, XP_REWARDS.grammarExercise, "exercise", todayISO());
    await logActivity(user.id, "grammar", exercise.type, todayISO());
    revalidatePath("/materi");
  }
  return { status: "idle", correct, explanation, firstCorrect };
}
