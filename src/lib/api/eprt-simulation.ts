import { warmTts } from "@/lib/api/tts";
import {
  claimSimulationPart,
  createSimulation,
  createToeflSession,
  deleteToeflSession,
  getSimulation,
  getToeflSession,
  listSimulations,
  listSimulationSessions,
  mergePartQuestions,
  updateSimulation,
  updateToeflSession,
} from "@/db/queries/toefl";
import { sqliteNow } from "@/db/schema";
import { AiError } from "@/lib/ai-client";
import { buildSimulationPartBatch, finishSession } from "@/lib/api/toefl-turn";
import {
  emptyParts,
  isExpired,
  parseParts,
  parseScope,
  parseScore,
  parseTimers,
  partBatches,
  partsInScope,
  remainingMs,
  SECTION_MINUTES,
  serializeTimers,
  SIM_PARTS,
  simulationScore,
  type SimScope,
  type SimulationScore,
} from "@/lib/eprt-simulation";
import {
  collectAnswers,
  correctCount,
  parseAnswers,
  parseQuestions,
  skillStats,
  type SkillStat,
  type ToeflSection,
} from "@/lib/toefl";

export type PartStatus = "locked" | "ready" | "active" | "done";

export type SimulationView = {
  id: number;
  createdAt: string;
  completedAt: string | null;
  /** Section mini-test; null untuk simulasi penuh. */
  scope: SimScope;
  score: SimulationScore | null;
  /** Akurasi per skill dari semua soal simulasi yang sudah dijawab. */
  skills: SkillStat[];
  /** Sisa waktu per section (ms); null kalau belum dimulai. */
  remaining: Record<ToeflSection, number | null>;
  parts: {
    index: number;
    title: string;
    count: number;
    sessionId: number | null;
    answered: number;
    status: PartStatus;
    /** Ditutup karena waktu section habis. */
    expired: boolean;
    section: ToeflSection;
  }[];
};

/** Mulai timer section saat bagian pertamanya dibuka; kembalikan sisa waktu (ms). */
export async function startSectionTimer(userId: number, simulationId: number, section: ToeflSection) {
  const sim = await getSimulation(userId, simulationId);
  if (!sim) throw new AiError("Simulasi tidak ditemukan.");
  const timers = parseTimers(sim.timers);
  if (!timers[section]) {
    timers[section] = new Date().toISOString();
    await updateSimulation(simulationId, { timers: serializeTimers(timers, parseScope(sim.timers)) });
  }
  return remainingMs(timers, section) ?? SECTION_MINUTES[section] * 60_000;
}

export async function startSimulation(userId: number, scope: SimScope = null) {
  const row = await createSimulation(userId, emptyParts());
  if (scope) await updateSimulation(row.id, { timers: serializeTimers({}, scope) });
  return row.id;
}

// Permintaan batch yang sama bisa datang bersamaan (prefetch + tombol "Mulai");
// permintaan kedua menunggu yang pertama supaya AI tidak dipanggil dua kali.
const inflight = new Map<string, Promise<number>>();

function parseProgress(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

/**
 * Siapkan satu batch dari sebuah bagian simulasi. Bagian besar dipecah jadi
 * batch kecil supaya tiap permintaan pendek; hasil tiap batch digabung ke satu
 * sesi yang utuh, jadi tampilan bagian tidak berubah. Idempoten: batch yang
 * sudah selesai tidak dibuat ulang.
 */
export function ensurePartBatch(userId: number, simulationId: number, index: number, batch: number) {
  const key = `${userId}:${simulationId}:${index}:${batch}`;
  const running = inflight.get(key);
  if (running) return running;
  const job = createPartBatch(userId, simulationId, index, batch).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

async function createPartBatch(
  userId: number,
  simulationId: number,
  index: number,
  batchIndex: number,
) {
  const part = SIM_PARTS[index];
  if (!part) throw new AiError("Bagian simulasi tidak ditemukan.");

  const sim = await getSimulation(userId, simulationId);
  if (!sim) throw new AiError("Simulasi tidak ditemukan.");
  const scope = parseScope(sim.timers);
  if (scope && part.section !== scope) throw new AiError("Bagian ini bukan bagian dari mini-test.");
  if (isExpired(parseTimers(sim.timers), part.section)) {
    throw new AiError("Waktu section ini sudah habis.");
  }

  const batches = partBatches(part);
  const batch = batches[batchIndex];
  if (!batch) throw new AiError("Batch bagian simulasi tidak ditemukan.");

  const parts = parseParts(sim.parts);
  let sessionId = parts[index];
  let row = sessionId ? await getToeflSession(userId, sessionId) : null;

  // Batch ini sudah ada; bagian yang tidak lengkap (mis. dibuat cara lama) ikut
  // dianggap selesai supaya tidak ada soal dobel.
  if (row && parseProgress(row.progress).includes(batchIndex)) return row.id;

  if (!row) {
    row = await createToeflSession({
      userId,
      track: "eptr",
      section: part.section,
      label: `Simulasi TOEFL ITP - ${part.title}`,
      passage: null,
      questions: JSON.stringify([]),
      questionCount: part.count,
      simulationId,
      progress: JSON.stringify([]),
    });
    // Permintaan lain (prefetch) bisa menyimpan lebih dulu; pakai yang pertama.
    // Klaim atomik supaya bagian lain yang disiapkan paralel tidak tertimpa.
    if (await claimSimulationPart(simulationId, index, row.id)) {
      sessionId = row.id;
    } else {
      await deleteToeflSession(row.id);
      const fresh = await getSimulation(userId, simulationId);
      sessionId = parseParts(fresh?.parts ?? null)[index] as number;
      row = sessionId ? await getToeflSession(userId, sessionId) : null;
      if (!row) throw new AiError("Bagian simulasi tidak ditemukan.");
    }
  }

  const first = part.first + batch.offset;
  const block = await buildSimulationPartBatch(userId, part.kind, batch.count, first);

  await warmTts(block.questions);

  const partSessionId = row.id;
  // Merge optimistik: batch paralel untuk bagian yang sama (dua tab) bisa
  // membaca snapshot lama. Update hanya lolos kalau kolom questions masih
  // persis snapshot saat dibaca; kalau kalah, baca ulang dan merge ulang.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const fresh = attempt === 0 ? row : await getToeflSession(userId, partSessionId);
    if (!fresh) throw new AiError("Bagian simulasi tidak ditemukan.");
    const progress = parseProgress(fresh.progress);
    if (progress.includes(batchIndex)) return fresh.id;
    const existing = parseQuestions(fresh.questions);
    const merged = [...existing, ...block.questions];
    if (!progress.includes(batchIndex)) progress.push(batchIndex);
    const written = await mergePartQuestions(
      fresh.id,
      fresh.questions,
      JSON.stringify(merged),
      fresh.passage ?? block.passage,
      JSON.stringify(progress.sort((a, b) => a - b)),
    );
    if (written) return fresh.id;
  }

  // Fallback: snapshot terus berubah (race ekstrem); tulis apa adanya supaya
  // batch tidak pernah hilang.
  const last = await getToeflSession(userId, partSessionId);
  if (!last) throw new AiError("Bagian simulasi tidak ditemukan.");
  const existing = parseQuestions(last.questions);
  const progress = parseProgress(last.progress);
  if (!progress.includes(batchIndex)) progress.push(batchIndex);
  await updateToeflSession(last.id, {
    questions: JSON.stringify([...existing, ...block.questions]),
    passage: last.passage ?? block.passage,
    progress: JSON.stringify(progress.sort((a, b) => a - b)),
  });
  return last.id;
}

export async function loadSimulation(userId: number, id: number): Promise<SimulationView | null> {
  const sim = await getSimulation(userId, id);
  if (!sim) return null;

  const ids = parseParts(sim.parts);
  const timers = parseTimers(sim.timers);
  const scope = parseScope(sim.timers);
  const inScope = partsInScope(scope);
  const rows = new Map((await listSimulationSessions(userId, id)).map((row) => [row.id, row]));

  // Waktu habis: tutup bagian yang masih terbuka supaya soal kosong dihitung salah.
  for (const { part, index } of inScope) {
    const row = ids[index] ? rows.get(ids[index] as number) : undefined;
    if (row && !row.completedAt && isExpired(timers, part.section)) {
      await finishSession(userId, row.id);
      row.completedAt = sqliteNow();
    }
  }

  const answerSets: Parameters<typeof collectAnswers>[0] = [];
  let unlocked = true;
  const results: { section: ToeflSection; correct: number; total: number }[] = [];
  const parts = inScope.map(({ part, index }) => {
    const row = ids[index] ? rows.get(ids[index] as number) : undefined;
    const questions = parseQuestions(row?.questions ?? null);
    const answers = parseAnswers(row?.answers ?? null, questions.length);
    answerSets.push({ section: part.section, questions, answers });
    const answered = answers.filter((answer) => answer !== null && answer >= 0).length;
    const count = questions.length || part.count;
    const expired = isExpired(timers, part.section) && answered < count;
    const done = Boolean(row?.completedAt) || expired;
    if (done) {
      results.push({
        section: part.section,
        correct: row ? correctCount(questions, answers) : 0,
        total: count,
      });
    }
    const status: PartStatus = done ? "done" : unlocked ? (row ? "active" : "ready") : "locked";
    if (!done) unlocked = false;
    return {
      index,
      title: part.title,
      count,
      sessionId: row?.id ?? null,
      answered,
      status,
      expired,
      section: part.section,
    };
  });

  const remaining = {
    listening: remainingMs(timers, "listening"),
    structure: remainingMs(timers, "structure"),
    reading: remainingMs(timers, "reading"),
  };

  let score = parseScore(sim.score);
  let completedAt = sim.completedAt;
  if (!completedAt && parts.every((part) => part.status === "done")) {
    score = simulationScore(results);
    completedAt = sqliteNow();
    await updateSimulation(id, { score: JSON.stringify(score), completedAt });
  }

  const skills = skillStats(collectAnswers(answerSets)).filter((stat) => stat.answered > 0);
  return { id: sim.id, createdAt: sim.createdAt, completedAt, scope, score, skills, remaining, parts };
}

export async function simulationHistory(userId: number) {
  const rows = await listSimulations(userId, 10);
  return rows.map((row) => {
    const ids = parseParts(row.parts);
    const scope = parseScope(row.timers);
    return {
      id: row.id,
      createdAt: row.createdAt,
      scope,
      partTotal: partsInScope(scope).length,
      completed: Boolean(row.completedAt),
      total: parseScore(row.score)?.total ?? null,
      score: parseScore(row.score),
      started: ids.filter(Boolean).length,
    };
  });
}
