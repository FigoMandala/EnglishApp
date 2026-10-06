type Level = "basic" | "intermediate" | "advanced";

export type UnitWordCandidate = {
  id: number;
  word: string;
  level: Level;
  topic: string | null;
  frequencyRank: number | null;
};

/** Judul item unit yang namanya tidak sama persis dengan topik kosakata. */
const TOPIC_ALIASES: Record<string, string> = {
  "benda sehari-hari": "rumah & perabot",
  "akademik lanjut": "akademik",
};

const LEVEL_ORDER: Level[] = ["basic", "intermediate", "advanced"];

/** "Kosakata: makanan & minuman" -> "makanan & minuman" */
export function topicFromItemTitle(title: string) {
  const raw = title.replace(/^kosakata\s*:\s*/i, "").trim().toLowerCase();
  return TOPIC_ALIASES[raw] ?? raw;
}

function byFrequency(a: UnitWordCandidate, b: UnitWordCandidate) {
  const ra = a.frequencyRank ?? Number.MAX_SAFE_INTEGER;
  const rb = b.frequencyRank ?? Number.MAX_SAFE_INTEGER;
  return ra - rb || a.word.localeCompare(b.word);
}

/**
 * Pilih kata untuk satu langkah kosakata di unit: cocokkan topik dari judul item,
 * utamakan level unit, lalu kata yang paling sering dipakai. Kalau topiknya tidak
 * ada, ambil kata selevel dengan offset per unit supaya tiap unit tetap berbeda.
 */
export function pickUnitWords<T extends UnitWordCandidate>(
  cards: T[],
  options: { title: string; level: Level; unitOrder: number; count: number },
): T[] {
  const { title, level, unitOrder, count } = options;
  const topic = topicFromItemTitle(title);
  const levelRank = (card: T) => Math.abs(LEVEL_ORDER.indexOf(card.level) - LEVEL_ORDER.indexOf(level));

  const inTopic = cards
    .filter((card) => card.topic?.toLowerCase() === topic)
    .sort((a, b) => levelRank(a) - levelRank(b) || byFrequency(a, b));
  if (inTopic.length > 0) return inTopic.slice(0, count);

  const sameLevel = cards.filter((card) => card.level === level).sort(byFrequency);
  const pool = sameLevel.length > 0 ? sameLevel : [...cards].sort(byFrequency);
  const start = (Math.max(0, unitOrder - 1) * count) % Math.max(1, pool.length);
  return [...pool.slice(start), ...pool.slice(0, start)].slice(0, count);
}
