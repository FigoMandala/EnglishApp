import { and, eq, inArray, notExists, sql } from "drizzle-orm";

import { db } from "@/db";
import { grammarExercises, grammarLessons, learningUnitProgress, learningUnits, users } from "@/db/schema";
import { setSetting } from "@/db/queries/activity";
import { moderateText } from "@/lib/moderation";
import { normalizeAnswer, parseAnswers, parseOptions } from "@/lib/grammar-exercise";
import { placedCefr, levelsToSkip, parseOnboarding, XP_PER_MINUTE, type PlacementResponse } from "@/lib/onboarding";
import type { WordLevel } from "@/lib/cefr";

export const ONBOARDING_KEY = "onboarding";
export const DAILY_GOAL_KEY = "daily_goal_xp";

export type PlacementQuestion = {
  id: number;
  level: WordLevel;
  prompt: string;
  options: string[];
  // Tanpa kunci jawaban: kunci tidak boleh sampai ke klien (audit keamanan
  // P2 — payload RSC halaman publik). Penilaian lewat server action.
};

/** Komposisi tes penempatan: makin tinggi tingkatnya, makin sedikit soalnya. */
const PLAN: [WordLevel, number][] = [
  ["basic", 3],
  ["intermediate", 3],
  ["advanced", 2],
];

function placementKeys(raw: string | null) {
  if (!raw) return [];
  return parseAnswers(raw).filter((key) => key.trim() !== "");
}

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
      // Kunci tetap jadi syarat kualitas soal, tapi tidak dikirim ke klien.
      const answers = placementKeys(row.answers);
      if (options.length >= 2 && answers.length > 0) out.push({ id: row.id, level, prompt: row.prompt, options });
    }
  }
  return out;
}

/** Kunci jawaban satu soal penempatan (untuk feedback server action, bukan payload halaman). */
export async function placementKeyTexts(id: number): Promise<string[]> {
  if (!Number.isInteger(id) || id <= 0) return [];
  const [row] = await db
    .select({ answers: grammarExercises.answers })
    .from(grammarExercises)
    .where(and(eq(grammarExercises.id, id), eq(grammarExercises.type, "choice")))
    .limit(1);
  return row ? placementKeys(row.answers) : [];
}

/**
 * Nilai ulang jawaban tes penempatan dari sisi server: skor deklarasi klien
 * tidak dipercaya (audit keamanan P2). Mengembalikan null kalau tidak ada
 * jawaban yang cocok dengan soal di bank.
 */
export async function gradePlacementResponses(responses: PlacementResponse[]) {
  const ids = [...new Set(responses.map((r) => r.id))].slice(0, 20);
  if (ids.length === 0) return null;
  const rows = await db
    .select({ id: grammarExercises.id, answers: grammarExercises.answers, level: grammarLessons.level })
    .from(grammarExercises)
    .innerJoin(grammarLessons, eq(grammarLessons.id, grammarExercises.lessonId))
    .where(and(inArray(grammarExercises.id, ids), eq(grammarExercises.type, "choice")));
  const byId = new Map(rows.map((row) => [row.id, row]));

  const byLevel: Record<WordLevel, [number, number]> = { basic: [0, 0], intermediate: [0, 0], advanced: [0, 0] };
  let score = 0;
  let total = 0;
  for (const response of responses) {
    const row = byId.get(response.id);
    if (!row) continue;
    total += 1;
    const keys = placementKeys(row.answers);
    const ok =
      response.choice !== null &&
      normalizeAnswer(response.choice) !== "" &&
      keys.some((key) => normalizeAnswer(key) === normalizeAnswer(response.choice!));
    if (ok) score += 1;
    byLevel[row.level][1] += 1;
    if (ok) byLevel[row.level][0] += 1;
  }
  return total > 0 ? { score, total, byLevel } : null;
}

/**
 * Bersihkan nama panggilan sebelum disimpan: NFKC + buang karakter tak
 * terlihat, lalu tolak kata terlarang. displayName adalah satu-satunya teks
 * milik pengguna yang tampil ke pengguna lain (papan liga) — sebelumnya
 * disimpan tanpa moderasi sama sekali dan homoglyph/zero-width mudah
 * melewati daftar kata terlarang (audit keamanan P3).
 */
function sanitizeDisplayName(raw: unknown) {
  if (typeof raw !== "string") return "";
  // NFKC menyamakan fullwidth/homoglyph umum; zero-width & pengendali dibuang.
  const normalized = raw.normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "").trim();
  // Huruf/angka apa pun bahasa + spasi + tanda baca nama yang umum.
  if (!normalized || normalized.length > 40) return "";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .,'-]*$/u.test(normalized)) return "";
  return moderateText(normalized).allowed ? normalized : "";
}

/**
 * Simpan hasil onboarding ke akun yang baru dibuat: preferensi, target harian,
 * dan lewati unit tingkat dasar yang sudah dikuasai (tanpa XP). Aman dipanggil dengan payload apa pun.
 */
export async function applyOnboarding(userId: number, rawOnboarding: unknown, rawName: unknown) {
  const name = sanitizeDisplayName(rawName);
  if (name) await db.update(users).set({ displayName: name }).where(eq(users.id, userId));

  const data = parseOnboarding(rawOnboarding);
  if (!data) return { skipped: 0 };

  // Skor penempatan selalu hasil penilaian ulang server dari jawaban mentah;
  // skor deklarasi klien tidak dipakai untuk keputusan level (audit P2).
  const placement = data.placementResponses.length
    ? await gradePlacementResponses(data.placementResponses)
    : null;
  const cefr = placedCefr({ ...data, placement });
  await setSetting(userId, ONBOARDING_KEY, {
    goal: data.goal,
    cefr,
    dailyMinutes: data.dailyMinutes,
    placement,
    completedAt: new Date().toISOString(),
  });
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
