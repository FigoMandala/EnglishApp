import { createChatMessage, listChatMessages } from "@/db/queries/chat";
import { logAiUsage } from "@/db/queries/ai-usage";
import { checkBudget } from "@/lib/ai-budget";
import { chatCompletionStream, AiError } from "@/lib/ai-client";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { guardUserInput } from "@/lib/moderation";
import { getCurrentUser } from "@/lib/session";

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
  "Jangan langsung menyebut huruf jawaban kecuali pengguna jelas memintanya.";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as { message?: unknown; context?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2_000) : "";
  const context = typeof body?.context === "string" ? body.context.trim().slice(0, 4_000) : "";
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
  const budget = await checkBudget();
  if (!budget.allowed) {
    return Response.json({ message: "Kuota AI harian habis. Coba lagi besok." }, { status: 429 });
  }

  await createChatMessage(user.id, "user", message);
  const history = await listChatMessages(user.id, 20);
  const messages = [
    { role: "system" as const, content: context ? `${SYSTEM} ${QUESTION_RULES}\n\n[SOAL]\n${context}` : SYSTEM },
    ...history.map((row) => ({ role: row.role as "user" | "assistant", content: row.content })),
  ];

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      let full = "";
      try {
        const result = await chatCompletionStream(config, messages, (delta) => {
          full += delta;
          send("delta", { text: delta });
        });
        await createChatMessage(user.id, "assistant", result.content || full);
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
      } finally {
        controller.close();
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
