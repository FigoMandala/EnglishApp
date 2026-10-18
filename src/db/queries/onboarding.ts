import { and, eq, inArray, notExists, sql } from "drizzle-orm";

import { db } from "@/db";
import { grammarExercises, grammarLessons, learningUnitProgress, learningUnits, users } from "@/db/schema";
import { setSetting } from "@/db/queries/activity";
import { parseAnswers, parseOptions } from "@/lib/grammar-exercise";
import { placedCefr, levelsToSkip, parseOnboarding, XP_PER_MINUTE } from "@/lib/onboarding";
import type { WordLevel } from "@/lib/cefr";

export const ONBOARDING_KEY = "onboarding";
export const DAILY_GOAL_KEY = "daily_goal_xp";

export type PlacementQuestion = {
  id: number;
  level: WordLevel;
  prompt: string;
  options: string[];
  answer: string;
};

/** Komposisi tes penempatan: makin tinggi tingkatnya, makin sedikit soalnya. */
const PLAN: [WordLevel, number][] = [
  ["basic", 3],
  ["intermediate", 3],
  ["advanced", 2],
];

/** Soal pilihan ganda lintas tingkat untuk tes penempatan (tanpa login, tanpa menyimpan jawaban). */
export async function placementQuestions(): Promise<PlacementQuestion[]> {
  const out: PlacementQuestion[] = [];
  for (const [level, count] of PLAN) {
    const rows = await db
      .select({
        id: grammarExercises.id,
        prompt: grammarExercises.prompt,
        options: grammarExercises.options,
        answers: grammarExercises.answers,
      })
      .from(grammarExercises)
      .innerJoin(grammarLessons, eq(grammarLessons.id, grammarExercises.lessonId))
      .where(and(eq(grammarExercises.type, "choice"), eq(grammarLessons.level, level)))
      .orderBy(sql`random()`)
      .limit(count);
    for (const row of rows) {
      const options = parseOptions(row.options);
      const answer = parseAnswers(row.answers)[0];
      if (options.length >= 2 && answer) out.push({ id: row.id, level, prompt: row.prompt, options, answer });
    }
  }
  return out;
}

/**
 * Simpan hasil onboarding ke akun yang baru dibuat: preferensi, target harian,
 * dan lewati unit tingkat dasar yang sudah dikuasai (tanpa XP). Aman dipanggil dengan payload apa pun.
 */
export async function applyOnboarding(userId: number, rawOnboarding: unknown, rawName: unknown) {
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 40) : "";
  if (name) await db.update(users).set({ displayName: name }).where(eq(users.id, userId));

  const data = parseOnboarding(rawOnboarding);
  if (!data) return { skipped: 0 };

  const cefr = placedCefr(data);
  await setSetting(userId, ONBOARDING_KEY, { ...data, cefr, completedAt: new Date().toISOString() });
  await setSetting(userId, DAILY_GOAL_KEY, data.dailyMinutes * XP_PER_MINUTE);

  const skip = levelsToSkip(cefr);
  if (skip.length === 0) return { skipped: 0 };
  const units = await db
    .select({ id: learningUnits.id })
    .from(learningUnits)
    .where(
      and(
        inArray(learningUnits.level, skip),
        notExists(
          db
            .select({ one: sql`1` })
            .from(learningUnitProgress)
            .where(and(eq(learningUnitProgress.unitId, learningUnits.id), eq(learningUnitProgress.userId, userId))),
        ),
      ),
    );
  if (units.length > 0) {
    await db
      .insert(learningUnitProgress)
      .values(units.map((unit) => ({ userId, unitId: unit.id, completedAt: sql`(datetime('now'))` })));
  }
  return { skipped: units.length };
}
