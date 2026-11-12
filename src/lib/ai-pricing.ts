export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export const EMPTY_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

type Rate = { input: number; output: number };

const PER_MILLION: Rate = { input: 0.1, output: 0.4 };

const PRICES: { match: RegExp; rate: Rate }[] = [
  { match: /gpt-6-luna/i, rate: { input: 0.011, output: 0.055 } }, // Rp 200 / Rp 998 per juta token; cache (Rp 50) tidak dihitung
  { match: /gemini.*flash/i, rate: { input: 0.059, output: 0.295 } },
  { match: /gemini.*pro/i, rate: { input: 1.25, output: 5 } },
  { match: /gpt-4o-mini/i, rate: { input: 0.15, output: 0.6 } },
  { match: /gpt-4o/i, rate: { input: 2.5, output: 10 } },
  { match: /claude.*haiku/i, rate: { input: 0.8, output: 4 } },
  { match: /claude.*sonnet/i, rate: { input: 3, output: 15 } },
  { match: /deepseek/i, rate: { input: 0.27, output: 1.1 } },
];

/**
 * Harga per juta token bisa ditimpa lewat env AI_PRICES, JSON { "nama-model": { "input": 1, "output": 4 } }
 * (nama model persis). Model baru yang belum ada di tabel di atas jatuh ke harga bawaan, yang kemungkinan keliru.
 */
function overridePrice(model: string): Rate | null {
  try {
    const parsed = JSON.parse(process.env.AI_PRICES ?? "{}") as Record<string, Partial<Rate>>;
    const entry = parsed[model];
    return entry && Number.isFinite(entry.input) && Number.isFinite(entry.output) ? { input: Number(entry.input), output: Number(entry.output) } : null;
  } catch {
    return null;
  }
}

export function priceFor(model: string): Rate {
  return overridePrice(model) ?? PRICES.find((entry) => entry.match.test(model))?.rate ?? PER_MILLION;
}

export function estimateCostUsd(model: string, usage: TokenUsage) {
  const rate = priceFor(model);
  const cost =
    (usage.promptTokens / 1_000_000) * rate.input +
    (usage.completionTokens / 1_000_000) * rate.output;
  return cost;
}
