import { db } from "@/db";
import { moderationFlags } from "@/db/schema";

/**
 * Moderasi ringan berbasis kata kunci untuk input/output AI.
 * Bukan pengganti classifier penuh, tapi menutup kasus paling jelas
 * (ujaran kebencian, konten seksual, kekerasan, prompt injection).
 */
const BLOCKED_PATTERNS: { reason: string; re: RegExp }[] = [
  { reason: "prompt-injection", re: /\b(ignore (all |previous )?instructions|reveal (your )?system prompt|abaikan instruksi)\b/i },
  { reason: "explicit", re: /\b(fuck you|kontol|memek|ngentot|bangsat)\b/i },
  { reason: "harassment", re: /\b(bodoh|goblok|idiot|bangsat|dungu)\b/i },
  { reason: "violence", re: /\b(bunuh|bom|senjata|kill you|bomb)\b/i },
];

export type ModerationResult = { allowed: boolean; reason?: string };

export function moderateText(text: string): ModerationResult {
  // Seluruh teks diperiksa (regex murah); memotong dulu membuka celah:
  // muatan setelah batas potong lolos tanpa flag.
  for (const { reason, re } of BLOCKED_PATTERNS) {
    if (re.test(text)) return { allowed: false, reason };
  }
  return { allowed: true };
}

export async function flagModeration(entry: {
  userId?: number | null;
  direction: "input" | "output";
  feature: string;
  reason: string;
  excerpt: string;
}) {
  await db.insert(moderationFlags).values({
    userId: entry.userId ?? null,
    direction: entry.direction,
    feature: entry.feature,
    reason: entry.reason,
    excerpt: entry.excerpt.slice(0, 300),
  });
}

/** Guard untuk input user: kalau diblokir, catat + kembalikan pesan. */
export async function guardUserInput(
  text: string,
  feature: string,
  userId?: number,
): Promise<ModerationResult> {
  const result = moderateText(text);
  if (!result.allowed) {
    await flagModeration({
      userId,
      direction: "input",
      feature,
      reason: result.reason ?? "blocked",
      excerpt: text,
    });
  }
  return result;
}