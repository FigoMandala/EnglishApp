import { and, asc, desc, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  activityLog,
  auditLogs,
  dataRequests,
  learningUnitItems,
  learningUnits,
  moderationFlags,
  questionBank,
  questionStats,
  sqliteNow,
  users,
  vocabularyProgress,
  type UserRole,
} from "@/db/schema";
import { bankItemPreview, LEECH_LAPSES, type WordStat } from "@/lib/admin";
import { judgeQuestion, type Verdict } from "@/lib/calibration";
import { fingerprint, questionText } from "@/lib/question-variety";
import { todayISO } from "@/lib/srs";
import { parseQuestions } from "@/lib/toefl";

import { getQuestionStats, type LevelBand } from "./question-bank";

export async function adminCounts() {
  const today = todayISO();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
  const [[userRow], [activeRow], bankRows, [flagRow]] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        admins: sql<number>`coalesce(sum(case when ${users.role} = 'admin' then 1 else 0 end), 0)`,
      })
      .from(users),
    db
      .select({ n: sql<number>`count(distinct ${activityLog.userId})` })
      .from(activityLog)
      .where(eq(activityLog.date, today)),
    db
      .select({ track: questionBank.track, n: sql<number>`count(*)` })
      .from(questionBank)
      .groupBy(questionBank.track),
    db
      .select({
        week: sql<number>`coalesce(sum(case when ${moderationFlags.createdAt} >= ${weekAgo} then 1 else 0 end), 0)`,
        open: sql<number>`coalesce(sum(case when ${moderationFlags.resolution} is null then 1 else 0 end), 0)`,
      })
      .from(moderationFlags),
  ]);
  const bank = Object.fromEntries(bankRows.map((row) => [row.track, Number(row.n)])) as Partial<
    Record<"toefl" | "eptr", number>
  >;
  return {
    users: Number(userRow?.total ?? 0),
    admins: Number(userRow?.admins ?? 0),
    activeToday: Number(activeRow?.n ?? 0),
    bankEptr: bank.eptr ?? 0,
    bankToefl: bank.toefl ?? 0,
    flagsWeek: Number(flagRow?.week ?? 0),
    flagsOpen: Number(flagRow?.open ?? 0),
  };
}

export async function recentAuditLogs(limit = 10) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      detail: auditLogs.detail,
      createdAt: auditLogs.createdAt,
      actor: users.username,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .orderBy(desc(auditLogs.id))
    .limit(limit);
}

/* ═══ Bank soal + kalibrasi ═══ */

export type BankStatus = "faulty" | "too-easy" | "ok" | "unknown";

const STATUS_RANK: Record<BankStatus, number> = { faulty: 0, "too-easy": 1, ok: 2, unknown: 3 };

/** Status item = status soal terburuk di dalamnya (sama seperti aturan picker soal). */
function worst(verdicts: Verdict[]): BankStatus {
  if (verdicts.includes("faulty")) return "faulty";
  if (verdicts.includes("too-easy")) return "too-easy";
  if (verdicts.includes("ok")) return "ok";
  return "unknown";
}

export type BankItemRow = {
  id: number;
  kind: string;
  skill: string | null;
  levelBand: LevelBand;
  preview: string;
  questions: number;
  attempts: number;
  correct: number;
  status: BankStatus;
  createdAt: string;
};

export async function listBankItems(track: "toefl" | "eptr"): Promise<BankItemRow[]> {
  const rows = await db.select().from(questionBank).where(eq(questionBank.track, track));
  const parsed = rows.map((row) => {
    let questions: ReturnType<typeof parseQuestions> = [];
    try {
      const stored = JSON.parse(row.item) as { questions?: unknown };
      questions = parseQuestions(JSON.stringify(stored.questions ?? []));
    } catch {
      // Item rusak tetap ditampilkan supaya bisa ditarik.
    }
    return { row, prints: questions.map((q) => fingerprint(questionText(q))) };
  });
  const stats = await getQuestionStats(track, parsed.flatMap((p) => p.prints));

  return parsed
    .map(({ row, prints }) => {
      const band = row.levelBand as LevelBand;
      const hits = prints.map((print) => stats.get(print));
      const { text, count } = bankItemPreview(row.item);
      return {
        id: row.id,
        kind: row.kind,
        skill: row.skill,
        levelBand: band,
        preview: text,
        questions: count,
        attempts: hits.reduce((sum, hit) => sum + (hit?.attempts ?? 0), 0),
        correct: hits.reduce((sum, hit) => sum + (hit?.correct ?? 0), 0),
        status: worst(hits.map((hit) => judgeQuestion(hit, band))),
        createdAt: row.createdAt,
      };
    })
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.attempts - a.attempts);
}

export async function getBankItem(id: number) {
  const [row] = await db.select().from(questionBank).where(eq(questionBank.id, id));
  return row ?? null;
}

export async function updateBankItem(id: number, values: { item: string; levelBand: LevelBand }) {
  await db.update(questionBank).set(values).where(eq(questionBank.id, id));
}

/** Hapus statistik kalibrasi soal yang isinya/kuncinya berubah, supaya dinilai ulang dari nol. */
export async function resetQuestionStats(track: "toefl" | "eptr", prints: string[]) {
  if (!prints.length) return;
  await db
    .delete(questionStats)
    .where(and(eq(questionStats.track, track), inArray(questionStats.fingerprint, prints)));
}

export async function deleteBankItem(id: number) {
  const [row] = await db
    .delete(questionBank)
    .where(eq(questionBank.id, id))
    .returning({ id: questionBank.id, track: questionBank.track, kind: questionBank.kind });
  return row ?? null;
}

/* ═══ Kosakata ═══ */

/** Statistik lupa per kata di semua pelajar, untuk mendeteksi kata leech. */
export async function vocabularyWordStats(): Promise<Map<number, WordStat>> {
  const rows = await db
    .select({
      vocabularyId: vocabularyProgress.vocabularyId,
      reviews: sql<number>`coalesce(sum(${vocabularyProgress.reviewCount}), 0)`,
      lapses: sql<number>`coalesce(sum(${vocabularyProgress.lapses}), 0)`,
      leechLearners: sql<number>`coalesce(sum(case when ${vocabularyProgress.lapses} >= ${LEECH_LAPSES} then 1 else 0 end), 0)`,
    })
    .from(vocabularyProgress)
    .groupBy(vocabularyProgress.vocabularyId);
  return new Map(
    rows.map((row) => [
      row.vocabularyId,
      { reviews: Number(row.reviews), lapses: Number(row.lapses), leechLearners: Number(row.leechLearners) },
    ]),
  );
}

/* ═══ Moderasi ═══ */

export async function listModerationFlags(view: "open" | "reviewed", limit = 50) {
  return db
    .select({
      id: moderationFlags.id,
      direction: moderationFlags.direction,
      feature: moderationFlags.feature,
      reason: moderationFlags.reason,
      excerpt: moderationFlags.excerpt,
      resolution: moderationFlags.resolution,
      reviewedAt: moderationFlags.reviewedAt,
      createdAt: moderationFlags.createdAt,
      username: users.username,
    })
    .from(moderationFlags)
    .leftJoin(users, eq(users.id, moderationFlags.userId))
    .where(view === "open" ? isNull(moderationFlags.resolution) : isNotNull(moderationFlags.resolution))
    .orderBy(desc(moderationFlags.id))
    .limit(limit);
}

/** Tandai flag sudah ditinjau. Mengembalikan null kalau flag tidak ada atau sudah ditinjau. */
export async function resolveModerationFlag(id: number, resolution: "safe" | "actioned") {
  const [row] = await db
    .update(moderationFlags)
    .set({ resolution, reviewedAt: sqliteNow() })
    .where(and(eq(moderationFlags.id, id), isNull(moderationFlags.resolution)))
    .returning({ id: moderationFlags.id, reason: moderationFlags.reason, feature: moderationFlags.feature });
  return row ?? null;
}

/* ═══ Materi & jalur belajar ═══ */

/** Semua unit, termasuk yang belum terbit, beserta isinya, sesuai urutan jalur. */
export async function listAllUnits() {
  const [units, items] = await Promise.all([
    db.select().from(learningUnits).orderBy(asc(learningUnits.orderIndex), asc(learningUnits.id)),
    db.select().from(learningUnitItems).orderBy(asc(learningUnitItems.orderIndex), asc(learningUnitItems.id)),
  ]);
  return units.map((unit) => ({ ...unit, items: items.filter((item) => item.unitId === unit.id) }));
}

/** Tulis ulang orderIndex 0..n sesuai urutan id yang diberikan. */
export async function setUnitOrder(ids: number[]) {
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(learningUnits).set({ orderIndex: index }).where(eq(learningUnits.id, id));
    }
  });
}

export async function setUnitItemOrder(unitId: number, ids: number[]) {
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(learningUnitItems)
        .set({ orderIndex: index })
        .where(and(eq(learningUnitItems.id, id), eq(learningUnitItems.unitId, unitId)));
    }
  });
}

export async function setUnitPublished(id: number, published: boolean) {
  const [row] = await db
    .update(learningUnits)
    .set({ published })
    .where(eq(learningUnits.id, id))
    .returning({ title: learningUnits.title });
  return row ?? null;
}

/* ═══ Pengguna & privasi ═══ */

export async function listDataRequests(limit = 30) {
  return db
    .select({
      id: dataRequests.id,
      kind: dataRequests.kind,
      status: dataRequests.status,
      createdAt: dataRequests.createdAt,
      username: users.username,
    })
    .from(dataRequests)
    .leftJoin(users, eq(users.id, dataRequests.userId))
    .orderBy(desc(dataRequests.id))
    .limit(limit);
}

export async function findUserRole(id: number) {
  const [row] = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users)
    .where(eq(users.id, id));
  return row ?? null;
}

export async function setUserRole(id: number, role: UserRole) {
  await db.update(users).set({ role }).where(eq(users.id, id));
}
