import { logAiUsage } from "@/db/queries/ai-usage";
import { chatJsonRaw, AiError } from "@/lib/ai-client";
import { releaseReservation, reserveBudget } from "@/lib/ai-budget";
import { EMPTY_USAGE } from "@/lib/ai-pricing";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { parseWritingScore, type WritingScore } from "@/lib/writing";

const SYSTEM = [
  "Kamu penilai esai Bahasa Inggris untuk pembelajar Indonesia yang menyiapkan TOEFL ITP dan EPrT.",
  "Nilai esai secara jujur dan membangun. Bila tulisannya lemah, beri skor rendah tanpa ragu.",
  "Seluruh catatan, alasan koreksi, dan ringkasan WAJIB dalam Bahasa Indonesia yang ringkas dan jelas.",
  "Koreksi hanya kesalahan yang benar-benar ada di esai; jangan mengarang kalimat yang tidak ditulis pengguna.",
  "Jangan pakai karakter em dash.",
  "Balas HANYA dengan objek JSON valid tanpa pagar kode dan tanpa teks lain.",
].join(" ");

const FORMAT = [
  "Format balasan:",
  '{"aspects":[{"aspect":"task","score":0-100,"note":"..."},{"aspect":"organization","score":0-100,"note":"..."},{"aspect":"grammar","score":0-100,"note":"..."},{"aspect":"vocabulary","score":0-100,"note":"..."}],',
  '"strengths":["kekuatan singkat"],"improvements":["saran perbaikan konkret"],',
  '"corrections":[{"original":"potongan asli dari esai","correction":"perbaikannya","reason":"alasan singkat"}],',
  '"summary":"2 sampai 3 kalimat penilaian keseluruhan"}',
  "Beri 3 sampai 6 koreksi paling penting saja. Skor 0-100 untuk tiap aspek.",
].join(" ");

const PARAGRAPH_SYSTEM = [
  "Kamu editor Bahasa Inggris untuk pembelajar Indonesia yang melatih satu paragraf akademik.",
  "Nilai hanya paragraf yang dikirim: kejelasan ide pokok, kerapian alur, grammar, dan pilihan kata.",
  "Kalau pengguna menulis kerangka, cek apakah paragrafnya benar-benar mengikuti kerangka itu.",
  "Jujur dan membangun; kalimat lemah tetap diberi skor rendah tanpa ragu.",
  "Seluruh catatan, alasan koreksi, dan ringkasan WAJIB dalam Bahasa Indonesia yang ringkas dan jelas.",
  "Koreksi hanya kesalahan yang benar-benar ada di paragraf; jangan mengarang kalimat.",
  "Jangan pakai karakter em dash.",
  "Balas HANYA dengan objek JSON valid tanpa pagar kode dan tanpa teks lain.",
].join(" ");

const PARAGRAPH_FORMAT = [
  "Format balasan:",
  '{"aspects":[{"aspect":"task","score":0-100,"note":"..."},{"aspect":"organization","score":0-100,"note":"..."},{"aspect":"grammar","score":0-100,"note":"..."},{"aspect":"vocabulary","score":0-100,"note":"..."}],',
  '"strengths":["kekuatan singkat"],"improvements":["saran perbaikan konkret"],',
  '"corrections":[{"original":"potongan asli dari paragraf","correction":"perbaikannya","reason":"alasan singkat"}],',
  '"summary":"1 sampai 2 kalimat penilaian paragraf"}',
  "Untuk latihan satu paragraf ini, beri 2 sampai 4 koreksi paling penting saja. Skor 0-100 untuk tiap aspek.",
].join(" ");

/** Panggil model, validasi JSON, dan catat pemakaian. Dipakai esai maupun paragraf. */
async function scoreWriting(userId: number, system: string, userMessage: string): Promise<WritingScore> {
  const config = await getAiConfig();
  if (!aiConfigured(config)) {
    throw new AiError("Tutor AI belum dikonfigurasi. Isi API key di Pengaturan.");
  }

  // Reservasi atomik mencegah request paralel menembus anggaran harian.
  // Satu reservasi menutup panggilan pertama + 1x retry di dalamnya.
  const reservation = await reserveBudget(userId, "writing", config.model);
  if (!reservation) {
    throw new AiError("Kuota AI harian habis. Coba lagi besok, atau hubungi admin.");
  }

  const startedAt = Date.now();
  let totalLatency = 0;
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: userMessage },
  ];

  try {
    // JSON mode + 1x retry supaya skor tetap bisa dibaca.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await chatJsonRaw(config, messages);
      totalLatency += result.latencyMs;
      const score = parseWritingScore(result.content);
      if (score) {
        await logAiUsage({
          userId,
          feature: "writing",
          model: config.model,
          usage: result.usage,
          latencyMs: totalLatency,
          ok: true,
        });
        return score;
      }
      messages.push({
        role: "user",
        content: "Balasan sebelumnya bukan JSON sesuai skema. Kirim ulang JSON yang benar saja.",
      });
    }
    throw new AiError("Penilaian AI tidak bisa dibaca. Coba lagi sebentar lagi.");
  } catch (error) {
    await logAiUsage({
      userId,
      feature: "writing",
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

export async function analyzeEssay(userId: number, prompt: string, essay: string): Promise<WritingScore> {
  const userMessage = [
    prompt.trim() ? `Topik esai: ${prompt.trim()}` : "Topik esai: bebas (esai argumentatif umum).",
    "",
    "Esai pengguna:",
    essay.trim(),
    "",
    FORMAT,
  ].join("\n");

  return scoreWriting(userId, SYSTEM, userMessage);
}

/** Koreksi satu paragraf untuk latihan kilat; kerangka opsional ikut dinilai. */
export async function reviewParagraph(
  userId: number,
  input: { prompt: string; outline: string; paragraph: string },
): Promise<WritingScore> {
  const userMessage = [
    input.prompt.trim() ? `Topik: ${input.prompt.trim()}` : "Topik: bebas.",
    input.outline.trim() ? `Kerangka yang direncanakan pengguna:\n${input.outline.trim()}` : "Pengguna tidak menulis kerangka.",
    "",
    "Paragraf pengguna:",
    input.paragraph.trim(),
    "",
    PARAGRAPH_FORMAT,
  ].join("\n");

  return scoreWriting(userId, PARAGRAPH_SYSTEM, userMessage);
}
