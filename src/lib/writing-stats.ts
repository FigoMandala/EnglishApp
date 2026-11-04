import {
  findPromptByTitle,
  PROMPT_LEVELS,
  WRITING_PROMPTS,
  type PromptLevel,
  type WritingPrompt,
} from "./writing-prompts";

export type WritingStatRow = {
  prompt: string;
  total: number;
  createdAt?: string;
};

export type PromptUsage = {
  prompt: WritingPrompt;
  count: number;
  best: number;
  last: string | null;
};

export type LevelUsage = {
  level: PromptLevel;
  essays: number;
  promptsTried: number;
  promptsTotal: number;
  avg: number | null;
  best: number | null;
};

export type TopicStats = {
  /** Esai yang topiknya cocok dengan katalog. */
  matched: number;
  /** Esai dengan topik bebas atau kosong. */
  custom: number;
  promptsTried: number;
  promptsTotal: number;
  top: PromptUsage[];
  levels: LevelUsage[];
};

type LevelAccumulator = { essays: number; sum: number; scored: number; best: number };

/**
 * Rangkum pemakaian prompt katalog dari riwayat esai.
 * Submission lama (topik bebas) tetap dihitung di `custom`, bukan dibuang.
 */
export function summarizeTopics(rows: WritingStatRow[]): TopicStats {
  const usage = new Map<string, PromptUsage>();
  const perLevel = new Map<PromptLevel, LevelAccumulator>();
  let matched = 0;
  let custom = 0;

  for (const row of rows) {
    const prompt = findPromptByTitle(row.prompt);
    if (!prompt) {
      custom += 1;
      continue;
    }
    matched += 1;
    const total = Math.round(Number(row.total) || 0);
    const entry = usage.get(prompt.id) ?? { prompt, count: 0, best: 0, last: null };
    entry.count += 1;
    entry.best = Math.max(entry.best, total);
    if (row.createdAt && (!entry.last || row.createdAt > entry.last)) entry.last = row.createdAt;
    usage.set(prompt.id, entry);

    const stat = perLevel.get(prompt.level) ?? { essays: 0, sum: 0, scored: 0, best: 0 };
    stat.essays += 1;
    if (total > 0) {
      stat.sum += total;
      stat.scored += 1;
      stat.best = Math.max(stat.best, total);
    }
    perLevel.set(prompt.level, stat);
  }

  const top = [...usage.values()].sort(
    (a, b) => b.count - a.count || b.best - a.best || a.prompt.title.localeCompare(b.prompt.title),
  );

  const levels = PROMPT_LEVELS.map((level): LevelUsage => {
    const stat = perLevel.get(level);
    return {
      level,
      essays: stat?.essays ?? 0,
      promptsTried: top.filter((entry) => entry.prompt.level === level).length,
      promptsTotal: WRITING_PROMPTS.filter((prompt) => prompt.level === level).length,
      avg: stat && stat.scored > 0 ? Math.round(stat.sum / stat.scored) : null,
      best: stat && stat.scored > 0 ? stat.best : null,
    };
  });

  return {
    matched,
    custom,
    promptsTried: top.length,
    promptsTotal: WRITING_PROMPTS.length,
    top,
    levels,
  };
}
