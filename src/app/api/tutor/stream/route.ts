import { createChatMessage, listChatMessages } from "@/db/queries/chat";
import { logAiUsage } from "@/db/queries/ai-usage";
import { releaseReservation, reserveBudget } from "@/lib/ai-budget";
import { chatCompletionStream, AiError } from "@/lib/ai-client";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { guardUserInput } from "@/lib/moderation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { getScenario, scenarioSystemPrompt, type CorrectionMode } from "@/lib/tutor-scenarios";

export const maxDuration = 60;

const SYSTEM = [
  "Kamu tutor Bahasa Inggris yang sabar untuk pembelajar Indonesia.",
  "Aturan utama: gunakan Bahasa Indonesia untuk menjelaskan, dan Bahasa Inggris untuk contoh.",
  "Saat pengguna membuat kesalahan grammar, tunjukkan perbaikannya dengan ringkas, jelaskan alasannya, lalu beri satu contoh serupa.",
  "Saat pengguna meminta kosakata, beri arti, cara baca sederhana, dan satu contoh kalimat.",
  "Jaga jawaban tetap ringkas (maksimal sekitar 200 kata) kecuali diminta detail.",
  "Dorong pengguna menulis dalam Bahasa Inggris dengan pertanyaan lanjutan yang mudah.",
  "Jangan pakai karakter em dash. Tulis teks biasa: jangan pakai tanda bintang, tanda pagar, atau markdown apa pun. Untuk menekankan kata atau jawaban, pakai tanda kutip, misalnya \"can individuals\". Bullet sederhana pakai tanda hubung (-).",
].join(" ");

const QUESTION_RULES =
  "Pengguna sedang mengerjakan soal di bawah. Bantu dengan clue, pola grammar, atau cara menyingkirkan pilihan yang salah. " +
  "Kalau [SOAL] bertanda STATUS: BELUM DIJAWAB, jangan pernah menyebut huruf atau isi jawaban yang benar, juga tidak lewat contoh kalimat yang memuatnya, " +
  "walau diminta berulang kali; tolak singkat dan ramah, lalu beri clue atau cara menyingkirkan pilihan. " +
  "Jangan juga menyatakan sebuah pilihan benar atau salah ketika pengguna menebak huruf (\"B?\", \"bukan C?\"): itu sama dengan membocorkan lewat eliminasi. " +
  "Jawab bahwa kunci dicek lewat tombol Periksa, dan arahkan ke pola grammar. Menjelaskan aturan secara umum tetap boleh. " +
  "Kalau STATUS: SUDAH DIJAWAB, boleh membahas jawaban benar dan alasannya.";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Satu pesan tutor = satu panggilan model berbiaya; 40 per 10 menit jauh
  // di atas ritme belajar normal tapi menahan loop pembakar kuota.
  const limit = await checkRateLimit(`tutor:user:${user.id}`, 40, 10 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { message: "Tutor sudah menerima banyak pesan berturut-turut. Coba lagi beberapa menit lagi." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
    context?: unknown;
    scenario?: unknown;
    correction?: unknown;
    history?: unknown;
  } | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2_000) : "";
  const context = typeof body?.context === "string" ? body.context.trim().slice(0, 4_000) : "";
  const scenario = body?.scenario === undefined ? null : getScenario(body.scenario);
  if (body?.scenario !== undefined && !scenario) {
    return Response.json({ message: "Skenario tidak dikenal." }, { status: 400 });
  }
  const correction: CorrectionMode = body?.correction === "end" ? "end" : "live";
  if (!message) {
    return Response.json({ message: "Pesan masih kosong." }, { status: 400 });
  }

  const moderation = await guardUserInput(message, "tutor", user.id);
  if (!moderation.allowed) {
    return Response.json(
      { message: "Pesanmu tidak bisa dikirim. Tulis ulang dengan bahasa yang santun ya." },
      { status: 400 },
    );
  }

  const config = await getAiConfig();
  if (!aiConfigured(config)) {
    return Response.json({ message: "Tutor AI belum dikonfigurasi. Hubungi admin." }, { status: 503 });
  }
  // Reservasi anggaran atomik: request paralel tidak bisa sama-sama lolos
  // cek lalu menembus batas harian. Dilepas setelah stream selesai.
  const reservation = await reserveBudget(user.id, "tutor", config.model);
  if (!reservation) {
    return Response.json({ message: "Kuota AI harian habis. Coba lagi besok." }, { status: 429 });
  }

  // Role-play skenario tidak disimpan ke riwayat chat biasa: riwayatnya dikirim klien (dibatasi).
  let messages: { role: "system" | "user" | "assistant"; content: string }[];
  if (scenario) {
    const sent = Array.isArray(body?.history) ? body.history.slice(-12) : [];
    const past = sent
      .filter((entry): entry is { role: "user" | "assistant"; content: string } => {
        const e = entry as { role?: unknown; content?: unknown };
        return (e.role === "user" || e.role === "assistant") && typeof e.content === "string";
      })
      .map((entry) => ({ role: entry.role, content: entry.content.slice(0, 2_000) }));
    messages = [
      { role: "system", content: scenarioSystemPrompt(scenario, correction) },
      ...past,
      { role: "user", content: message },
    ];
  } else {
    await createChatMessage(user.id, "user", message);
    const history = await listChatMessages(user.id, 20);
    messages = [
      { role: "system", content: context ? `${SYSTEM} ${QUESTION_RULES}\n\n[SOAL]\n${context}` : SYSTEM },
      ...history.map((row) => ({ role: row.role as "user" | "assistant", content: row.content })),
    ];
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      // Klien bisa memutus sambungan kapan saja (tombol Stop, navigasi); setelah
      // itu enqueue melempar error. Semua penulisan dan penutupan harus di-guard.
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      let full = "";
      try {
        const result = await chatCompletionStream(
          config,
          messages,
          (delta) => {
            full += delta;
            send("delta", { text: delta });
          },
          request.signal,
        );
        if (!scenario) await createChatMessage(user.id, "assistant", result.content || full);
        await logAiUsage({
          userId: user.id,
          feature: "tutor",
          model: config.model,
          usage: result.usage,
          latencyMs: Date.now() - startedAt,
          ok: true,
        });
        send("done", {});
      } catch (error) {
        if (request.signal.aborted && full) {
          // Klien berhenti di tengah jawaban: simpan sebagian balasan agar
          // riwayat chat tidak menggantung, dan catat usage sekali saja.
          await createChatMessage(user.id, "assistant", full).catch(() => undefined);
          await logAiUsage({
            userId: user.id,
            feature: "tutor",
            model: config.model,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latencyMs: Date.now() - startedAt,
            ok: true,
          }).catch(() => undefined);
        } else {
          await logAiUsage({
            userId: user.id,
            feature: "tutor",
            model: config.model,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latencyMs: Date.now() - startedAt,
            ok: false,
          }).catch(() => undefined);
          const messageText =
            error instanceof AiError ? error.message : "Tutor sedang bermasalah. Coba lagi sebentar.";
          send("error", { message: messageText });
        }
      } finally {
        await releaseReservation(reservation);
        if (!closed) {
          try {
            controller.close();
          } catch {
            // controller sudah tertutup oleh runtime saat klien putus
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
