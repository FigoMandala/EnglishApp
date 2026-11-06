import { logAiUsage } from "@/db/queries/ai-usage";
import { releaseReservation, reserveBudget } from "@/lib/ai-budget";
import { chatCompletionDetailed, AiError } from "@/lib/ai-client";
import { EMPTY_USAGE } from "@/lib/ai-pricing";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { checkRateLimit } from "@/lib/rate-limit";

export type SentenceFeedback = {
  corrected: string;
  ok: boolean;
  notes: string[];
  praise: string;
};

const SYSTEM = [
  "Kamu guru Bahasa Inggris untuk pembelajar Indonesia tingkat pemula.",
  "Tugasmu memeriksa SATU kalimat pendek buatan pengguna.",
  "Bila kalimatnya benar, set ok=true dan corrected sama persis dengan kalimat pengguna.",
  "Bila ada kesalahan, set ok=false, tulis perbaikan paling wajar di corrected.",
  "Catatan (notes) dan pujian (praise) WAJIB dalam Bahasa Indonesia yang sangat sederhana dan singkat.",
  "Maksimal 3 catatan. Jelaskan kesalahan umum seperti a/an, to be, atau bentuk jamak dengan bahasa awam.",
  "Jangan pakai karakter em dash.",
  "Balas HANYA dengan objek JSON valid tanpa pagar kode dan tanpa teks lain.",
].join(" ");

const FORMAT = [
  "Format balasan:",
  '{"ok":true|false,"corrected":"kalimat yang sudah diperbaiki","notes":["catatan singkat"],"praise":"satu kalimat pujian singkat"}',
].join(" ");

export async function checkSentence(
  userId: number,
  word: string | null,
  sentence: string,
): Promise<SentenceFeedback> {
  const config = await getAiConfig();
  if (!aiConfigured(config)) {
    throw new AiError("Tutor AI belum dikonfigurasi. Isi API key di Pengaturan.");
  }

  const limit = await checkRateLimit(`grammar:user:${userId}`, 60, 10 * 60_000);
  if (!limit.ok) {
    throw new AiError("Latihan compose sudah melewati batas sementara. Istirahat dulu sebentar ya.");
  }

  // Pagar biaya: koreksi compose ikut kuota AI harian global (kill-switch
  // admin) dan punya batas per-user supaya tidak bisa dipompa dalam loop.
  // Reservasi atomik mencegah request paralel menembus anggaran.
  const reservation = await reserveBudget(userId, "grammar", config.model);
  if (!reservation) {
    throw new AiError("Kuota AI harian habis. Coba lagi besok, atau hubungi admin.");
  }

  const userMessage = [
    word ? `Kata yang harus dipakai: ${word}` : "Pengguna menulis kalimat bebas.",
    "",
    "Kalimat pengguna:",
    sentence.trim(),
  ].join("\n");

  const startedAt = Date.now();
  try {
    const result = await chatCompletionDetailed(config, [
      { role: "system", content: SYSTEM },
      { role: "user", content: `${userMessage}\n\n${FORMAT}` },
    ]);
    await logAiUsage({
      userId,
      feature: "grammar",
      model: config.model,
      usage: result.usage,
      latencyMs: result.latencyMs,
      ok: true,
    });
    const feedback = parseSentenceFeedback(result.content, sentence);
    if (!feedback) throw new AiError("Koreksi AI tidak bisa dibaca. Coba lagi sebentar lagi.");
    return feedback;
  } catch (error) {
    await logAiUsage({
      userId,
      feature: "grammar",
      model: config.model,
      usage: EMPTY_USAGE,
      latencyMs: Date.now() - startedAt,
      ok: false,
    });
    throw error;
  } finally {
    await releaseReservation(reservation);
  }
}

function extractJson(raw: string) {
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? stripped).trim();
  const start = candidate.search(/[{[]/);
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (start < 0 || end <= start) return candidate;
  return candidate.slice(start, end + 1);
}

function stringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      const text = String(entry ?? "").trim().slice(0, 200);
      return text ? [text] : [];
    })
    .slice(0, limit);
}

export function parseSentenceFeedback(raw: string, original: string): SentenceFeedback | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const corrected = String(record.corrected ?? "").trim().slice(0, 400) || original.trim();
  return {
    ok: record.ok === true,
    corrected,
    notes: stringList(record.notes, 3),
    praise: String(record.praise ?? "").trim().slice(0, 200),
  };
}