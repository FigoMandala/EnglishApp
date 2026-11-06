import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { fingerprint, questionText } from "@/lib/question-variety";
import { parseQuestions } from "@/lib/toefl";
import { eprtSimulations, toeflReviews, toeflSessions, type ToeflSession } from "@/db/schema";

export type Track = "toefl" | "eptr";

export async function listToeflSessions(userId: number, limit = 30, track: Track = "toefl") {
  return db
    .select()
    .from(toeflSessions)
    .where(and(eq(toeflSessions.userId, userId), eq(toeflSessions.track, track)))
    .orderBy(desc(toeflSessions.id))
    .limit(limit);
}

export async function getToeflSession(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(toeflSessions)
    .where(and(eq(toeflSessions.id, id), eq(toeflSessions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createToeflSession(values: {
  userId: number;
  track: Track;
  section: ToeflSession["section"];
  label: string;
  passage: string | null;
  questions: string;
  questionCount: number;
  simulationId?: number;
  progress?: string;
}) {
  const { questionCount, ...rest } = values;
  const answers = JSON.stringify(Array.from({ length: questionCount }, () => null));
  const [row] = await db
    .insert(toeflSessions)
    .values({ ...rest, answers })
    .returning();
  return row;
}

export async function updateToeflSession(
  id: number,
  values: {
    answers?: string;
    questions?: string;
    passage?: string | null;
    progress?: string;
    completedAt?: string | null;
    score?: number | null;
  },
) {
  await db.update(toeflSessions).set(values).where(eq(toeflSessions.id, id));
}

export async function listStandaloneSessions(userId: number, limit: number, track: Track) {
  return db
    .select()
    .from(toeflSessions)
    .where(
      and(
        eq(toeflSessions.userId, userId),
        eq(toeflSessions.track, track),
        isNull(toeflSessions.simulationId),
      ),
    )
    .orderBy(desc(toeflSessions.id))
    .limit(limit);
}

export async function deleteToeflSession(id: number) {
  await db.delete(toeflSessions).where(eq(toeflSessions.id, id));
}

export async function listSimulationSessions(userId: number, simulationId: number) {
  return db
    .select()
    .from(toeflSessions)
    .where(and(eq(toeflSessions.userId, userId), eq(toeflSessions.simulationId, simulationId)));
}

export async function createSimulation(userId: number, parts: string) {
  const [row] = await db.insert(eprtSimulations).values({ userId, parts }).returning();
  return row;
}

export async function getSimulation(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(eprtSimulations)
    .where(and(eq(eprtSimulations.id, id), eq(eprtSimulations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listSimulations(userId: number, limit = 10) {
  return db
    .select()
    .from(eprtSimulations)
    .where(eq(eprtSimulations.userId, userId))
    .orderBy(desc(eprtSimulations.id))
    .limit(limit);
}

export async function updateSimulation(
  id: number,
  values: { parts?: string; score?: string | null; completedAt?: string | null; timers?: string },
) {
  await db.update(eprtSimulations).set(values).where(eq(eprtSimulations.id, id));
}

/**
 * Isi slot bagian `index` secara atomik, hanya kalau masih kosong. Aman dipanggil
 * paralel untuk bagian berbeda: tiap update hanya menyentuh slotnya sendiri.
 * Mengembalikan true kalau slot berhasil diklaim.
 */
export async function claimSimulationPart(id: number, index: number, sessionId: number) {
  const path = `$[${index}]`;
  const rows = await db
    .update(eprtSimulations)
    .set({ parts: sql`json_set(${eprtSimulations.parts}, ${path}, ${sessionId})` })
    .where(
      and(
        eq(eprtSimulations.id, id),
        sql`json_extract(${eprtSimulations.parts}, ${path}) is null`,
      ),
    )
    .returning({ id: eprtSimulations.id });
  return rows.length > 0;
}

/**
 * Gabungkan soal batch ke sesi bagian simulasi secara optimistik: update hanya
 * lolos kalau kolom `questions` masih persis teks yang baru dibaca. Dua batch
 * paralel untuk bagian yang sama (mis. dua tab) tidak lagi saling menimpa
 * daftar soal; yang kalah baca ulang dan merge ulang.
 * Mengembalikan true kalau merge berhasil ditulis.
 */
export async function mergePartQuestions(
  id: number,
  expectedQuestions: string,
  mergedQuestions: string,
  passage: string | null,
  progress: string,
) {
  const rows = await db
    .update(toeflSessions)
    .set({ questions: mergedQuestions, passage, progress })
    .where(and(eq(toeflSessions.id, id), eq(toeflSessions.questions, expectedQuestions)))
    .returning({ id: toeflSessions.id });
  return rows.length > 0;
}

/**
 * Simpan satu jawaban secara atomik: json_set hanya menulis slot `index`, dan
 * hanya kalau slot masih kosong serta sesi belum ditutup. Aman terhadap
 * pengiriman paralel (antrean offline klien) yang dulu saling menimpa jawaban.
 * Mengembalikan isi kolom answers terbaru kalau slot berhasil diisi, null kalau tidak.
 */
export async function setSessionAnswer(id: number, index: number, choice: number) {
  const path = `$[${index}]`;
  const [row] = await db
    .update(toeflSessions)
    .set({ answers: sql`json_set(${toeflSessions.answers}, ${path}, ${choice})` })
    .where(
      and(
        eq(toeflSessions.id, id),
        isNull(toeflSessions.completedAt),
        sql`json_extract(${toeflSessions.answers}, ${path}) is null`,
      ),
    )
    .returning({ answers: toeflSessions.answers });
  return row ?? null;
}

export async function listDueReviews(userId: number, today: string, limit = 15) {
  return db
    .select()
    .from(toeflReviews)
    .where(and(eq(toeflReviews.userId, userId), lte(toeflReviews.dueAt, today)))
    .orderBy(asc(toeflReviews.dueAt), asc(toeflReviews.id))
    .limit(limit);
}

export async function countReviews(userId: number, today: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      due: sql<number>`coalesce(sum(case when ${toeflReviews.dueAt} <= ${today} then 1 else 0 end), 0)`,
    })
    .from(toeflReviews)
    .where(eq(toeflReviews.userId, userId));
  return { total: Number(row?.total ?? 0), due: Number(row?.due ?? 0) };
}

export async function getReview(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(toeflReviews)
    .where(and(eq(toeflReviews.id, id), eq(toeflReviews.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Review teraktif untuk satu soal (berdasarkan fingerprint pertanyaan), kalau ada.
 * Dipakai supaya menjawab soal yang sama salah berkali-kali tidak membuat
 * baris review baru setiap kali.
 *
 * Catatan: pencocokan masih dilakukan di JS (parse tiap baris), jadi hanya
 * kolom yang dipakai yang diambil. Kalau review menumpuk (ribuan baris),
 * tambahkan kolom `fingerprint` + index dan cari langsung di SQL.
 */
export async function findActiveReview(userId: number, questionFingerprint: string) {
  // Jalur cepat: cocokkan kolom fingerprint lewat index (setelah backfill
  // semua baris baru terisi).
  const [direct] = await db
    .select({
      id: toeflReviews.id,
      question: toeflReviews.question,
      box: toeflReviews.box,
      dueAt: toeflReviews.dueAt,
    })
    .from(toeflReviews)
    .where(
      and(eq(toeflReviews.userId, userId), eq(toeflReviews.fingerprint, questionFingerprint)),
    )
    .orderBy(desc(toeflReviews.id))
    .limit(1);
  if (direct) return direct;

  // Baris lama sebelum kolom fingerprint ada: scan hanya baris null yang
  // makin menyusut setelah skrip db:dedup-reviews mengisi sidik jarinya.
  const rows = await db
    .select({
      id: toeflReviews.id,
      question: toeflReviews.question,
      box: toeflReviews.box,
      dueAt: toeflReviews.dueAt,
    })
    .from(toeflReviews)
    .where(and(eq(toeflReviews.userId, userId), isNull(toeflReviews.fingerprint)))
    .orderBy(desc(toeflReviews.id));
  return (
    rows.find((row) =>
      parseQuestions(row.question).some(
        (question) => fingerprint(questionText(question)) === questionFingerprint,
      ),
    ) ?? null
  );
}

export async function createReview(values: {
  userId: number;
  question: string;
  fingerprint?: string;
  box: number;
  dueAt: string;
}) {
  await db.insert(toeflReviews).values(values);
}

export async function updateReview(id: number, values: { box: number; dueAt: string }) {
  await db.update(toeflReviews).set(values).where(eq(toeflReviews.id, id));
}

export async function deleteReview(id: number) {
  await db.delete(toeflReviews).where(eq(toeflReviews.id, id));
}
