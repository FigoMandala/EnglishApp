import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { writingSubmissions, type WritingSubmission } from "@/db/schema";
import { parseStoredScore } from "@/lib/writing";

export async function createWritingSubmission(values: {
  userId: number;
  prompt: string;
  essay: string;
  wordCount: number;
  feedback: string;
  total: number;
}) {
  const [row] = await db.insert(writingSubmissions).values(values).returning();
  return row;
}

export async function getWritingSubmission(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(writingSubmissions)
    .where(and(eq(writingSubmissions.id, id), eq(writingSubmissions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listWritingSubmissions(userId: number, limit = 12) {
  return db
    .select()
    .from(writingSubmissions)
    .where(eq(writingSubmissions.userId, userId))
    .orderBy(desc(writingSubmissions.id))
    .limit(limit);
}

/** Topik + skor semua esai, untuk statistik pemakaian prompt. */
export async function listWritingScores(userId: number, limit = 300) {
  return db
    .select({
      prompt: writingSubmissions.prompt,
      total: writingSubmissions.total,
      createdAt: writingSubmissions.createdAt,
    })
    .from(writingSubmissions)
    .where(eq(writingSubmissions.userId, userId))
    .orderBy(desc(writingSubmissions.id))
    .limit(limit);
}

/** Judul prompt yang pernah dipakai pengguna, untuk menandai topik yang sudah ditulis. */
export async function listWrittenPrompts(userId: number) {
  const rows = await db
    .selectDistinct({ prompt: writingSubmissions.prompt })
    .from(writingSubmissions)
    .where(eq(writingSubmissions.userId, userId));
  return rows.map((row) => row.prompt).filter((prompt) => prompt.trim().length > 0);
}

export type WritingSummary = {
  id: number;
  prompt: string;
  wordCount: number;
  total: number;
  createdAt: string;
};

export function toSummary(row: WritingSubmission): WritingSummary {
  return {
    id: row.id,
    prompt: row.prompt,
    wordCount: row.wordCount,
    total: row.total,
    createdAt: row.createdAt,
  };
}

export { parseStoredScore };