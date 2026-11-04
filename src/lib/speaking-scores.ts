/**
 * Skor terbaik per topik speaking. Disimpan sebagai JSON di `user_settings`
 * (pola yang sama dengan target/trend EPrT), jadi tidak perlu tabel baru.
 */
export type SpeakingBest = Record<string, number>;

/** Jepit skor ke 0–100 dan bulatkan; NaN/Infinity dianggap tidak valid. */
function clampScore(score: number): number | null {
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Catat skor satu topik, hanya menyimpan yang lebih tinggi.
 * Mengembalikan objek yang sama kalau tidak ada perbaikan, supaya pemanggil
 * bisa melewati penulisan ke database.
 */
export function recordSpeakingScore(best: SpeakingBest, topicId: string, score: number): SpeakingBest {
  const id = topicId.trim();
  const value = clampScore(score);
  if (!id || value === null) return best;
  const previous = best[id];
  if (previous !== undefined && previous >= value) return best;
  return { ...best, [id]: value };
}

/** Banyaknya topik dari katalog yang sudah pernah dicoba. */
export function triedTopicCount(best: SpeakingBest, topicIds: string[]): number {
  return topicIds.filter((id) => best[id] !== undefined).length;
}

/** Rata-rata skor terbaik dari topik yang sudah dicoba, atau null kalau belum ada. */
export function averageBest(best: SpeakingBest, topicIds: string[]): number | null {
  const scores = topicIds.map((id) => best[id]).filter((score): score is number => score !== undefined);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

/**
 * Bersihkan data dari `user_settings`: buang id yang tidak ada di katalog,
 * skor di luar 0–100, dan nilai yang bukan angka.
 */
export function normalizeSpeakingBest(raw: unknown, topicIds: string[]): SpeakingBest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allowed = new Set(topicIds);
  const clean: SpeakingBest = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(id)) continue;
    const score = clampScore(typeof value === "number" ? value : Number.NaN);
    if (score === null) continue;
    clean[id] = score;
  }
  return clean;
}
