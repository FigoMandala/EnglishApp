import type { AiConfig } from "./ai-config";
import { EMPTY_USAGE, type TokenUsage } from "./ai-pricing";

export const TIMEOUT_MS = 110_000;

export type ChatRole = "system" | "user" | "assistant";

export type ProviderMessage = {
  role: ChatRole;
  content: string | { type: "text"; text: string }[];
};

export class AiError extends Error {}

export type ChatResult = {
  content: string;
  usage: TokenUsage;
  latencyMs: number;
};

type ProviderResponse = {
  choices?: { message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function textOf(content: ProviderMessage["content"]) {
  return typeof content === "string" ? content : content.map((part) => part.text).join("\n");
}

/**
 * Sebagian provider/proxy membuang pesan `system` dan memakai persona sendiri,
 * jadi instruksi system dilebur ke pesan user terakhir. Aman untuk semua provider.
 */
export function foldSystemMessages(messages: ProviderMessage[]): ProviderMessage[] {
  const system = messages.filter((message) => message.role === "system").map((message) => textOf(message.content));
  const rest = messages.filter((message) => message.role !== "system");
  if (!system.length) return rest;
  const instructions = `[INSTRUKSI SISTEM - wajib diikuti]\n${system.join("\n\n")}`;
  const last = rest.map((message) => message.role).lastIndexOf("user");
  if (last < 0) return [{ role: "user", content: instructions }, ...rest];
  return rest.map((message, index) =>
    index === last
      ? { role: "user", content: `${instructions}\n\n[PESAN PENGGUNA]\n${textOf(message.content)}` }
      : message,
  );
}

export async function chatCompletionDetailed(
  config: AiConfig,
  messages: ProviderMessage[],
): Promise<ChatResult> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages: foldSystemMessages(messages) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.error(`[ai] model ${config.model} tidak menjawab dalam ${TIMEOUT_MS / 1000} detik`);
      throw new AiError(
        `Model AI (${config.model}) terlalu lambat, tidak menjawab dalam ${TIMEOUT_MS / 1000} detik. Coba lagi, atau minta admin memilih model yang lebih cepat.`,
      );
    }
    console.error("[ai] gagal menghubungi penyedia:", error);
    throw new AiError("Tidak bisa menghubungi layanan AI. Coba lagi sebentar lagi.");
  }

  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[ai] status ${response.status}: ${body.slice(0, 200)}`);
    throw new AiError(`Layanan AI mengembalikan status ${response.status}.`);
  }

  const data = (await response.json()) as ProviderResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError("Layanan AI tidak mengembalikan jawaban.");

  const promptTokens = Number(data.usage?.prompt_tokens ?? 0) || 0;
  const completionTokens = Number(data.usage?.completion_tokens ?? 0) || 0;
  const totalTokens = Number(data.usage?.total_tokens ?? 0) || promptTokens + completionTokens;

  return {
    content,
    usage: { promptTokens, completionTokens, totalTokens },
    latencyMs,
  };
}

export async function chatCompletion(config: AiConfig, messages: ProviderMessage[]) {
  const result = await chatCompletionDetailed(config, messages);
  return result.content;
}

/**
 * JSON mode: paksa model mengembalikan JSON valid, lalu validasi + 1x retry
 * perbaikan kalau hasilnya malformed. Mengurangi kegagalan parsing drastis.
 */
export async function chatJson<T>(
  config: AiConfig,
  messages: ProviderMessage[],
  validate: (value: unknown) => T | null,
): Promise<{ data: T; usage: TokenUsage; latencyMs: number }> {
  const withMode: ProviderMessage[] = [
    ...messages,
    { role: "system", content: "Balas HANYA dengan JSON valid, tanpa teks lain, tanpa markdown fence." },
  ];

  let usage: TokenUsage = EMPTY_USAGE;
  let latencyMs = 0;
  let lastRaw = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await chatCompletionRaw(config, withMode, true);
    usage = result.usage;
    latencyMs += result.latencyMs;
    lastRaw = result.content;

    const parsed = extractJson(result.content);
    if (parsed !== null) {
      const valid = validate(parsed);
      if (valid !== null) return { data: valid, usage, latencyMs };
    }

    withMode.push({
      role: "user",
      content: "Output sebelumnya bukan JSON valid atau tidak sesuai skema. Perbaiki dan kirim ulang JSON yang benar saja.",
    });
  }

  console.error(`[ai] JSON tidak valid setelah 2 percobaan: ${lastRaw.slice(0, 200)}`);
  throw new AiError("Model AI tidak mengembalikan data yang bisa dibaca. Coba lagi.");
}

/** Ambil objek/array JSON pertama dari string (toleran markdown fence). */
export function extractJson(raw: string): unknown | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Cari blok { ... } atau [ ... ] terluar.
    const first = cleaned.search(/[{[]/);
    if (first < 0) return null;
    const last = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (last <= first) return null;
    try {
      return JSON.parse(cleaned.slice(first, last + 1));
    } catch {
      return null;
    }
  }
}

/** Versi publik: paksa JSON mode, tanpa validasi skema. */
export function chatJsonRaw(config: AiConfig, messages: ProviderMessage[], timeoutMs = TIMEOUT_MS) {
  return chatCompletionRaw(config, messages, true, timeoutMs);
}

async function chatCompletionRaw(
  config: AiConfig,
  messages: ProviderMessage[],
  jsonMode: boolean,
  timeoutMs = TIMEOUT_MS,
): Promise<ChatResult> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const startedAt = Date.now();
  const send = (useJsonMode: boolean) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: foldSystemMessages(messages),
        ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(Math.max(1_000, timeoutMs - (Date.now() - startedAt))),
    });

  let response: Response;
  try {
    response = await send(jsonMode);
    // Sebagian provider non-OpenAI menolak response_format. Coba lagi tanpa itu.
    if (jsonMode && response.status === 400) {
      const detail = await response.text().catch(() => "");
      if (/response_format/i.test(detail)) {
        console.warn(`[ai] provider menolak response_format, mencoba tanpa JSON mode: ${detail.slice(0, 120)}`);
        response = await send(false);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AiError(
        `Model AI (${config.model}) terlalu lambat, tidak menjawab dalam ${Math.round(timeoutMs / 1000)} detik. Coba lagi, atau minta admin memilih model yang lebih cepat.`,
      );
    }
    throw new AiError("Tidak bisa menghubungi layanan AI. Coba lagi sebentar lagi.");
  }
  const latencyMs = Date.now() - startedAt;
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[ai] status ${response.status}: ${body.slice(0, 200)}`);
    throw new AiError(`Layanan AI mengembalikan status ${response.status}.`);
  }
  const data = (await response.json()) as ProviderResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError("Layanan AI tidak mengembalikan jawaban.");
  const promptTokens = Number(data.usage?.prompt_tokens ?? 0) || 0;
  const completionTokens = Number(data.usage?.completion_tokens ?? 0) || 0;
  const totalTokens = Number(data.usage?.total_tokens ?? 0) || promptTokens + completionTokens;
  return { content, usage: { promptTokens, completionTokens, totalTokens }, latencyMs };
}

/**
 * Streaming teks (SSE) untuk tutor. onDelta dipanggil tiap potongan.
 * Mengembalikan teks lengkap + usage (kalau disediakan provider di akhir).
 */
export async function chatCompletionStream(
  config: AiConfig,
  messages: ProviderMessage[],
  onDelta: (text: string) => void,
): Promise<ChatResult> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages: foldSystemMessages(messages), stream: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new AiError("Tidak bisa menghubungi layanan AI. Coba lagi sebentar lagi.");
  }

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    console.error(`[ai] stream status ${response.status}: ${body.slice(0, 200)}`);
    throw new AiError(`Layanan AI mengembalikan status ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let usage: TokenUsage = EMPTY_USAGE;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens ?? 0,
            completionTokens: chunk.usage.completion_tokens ?? 0,
            totalTokens: chunk.usage.total_tokens ?? 0,
          };
        }
      } catch {
        // abaikan baris yang tidak bisa diparse
      }
    }
  }

  return { content: full, usage, latencyMs: Date.now() - startedAt };
}

export { EMPTY_USAGE };

/** Daftar model dari endpoint /models (kompatibel OpenAI). Kosong kalau tidak tersedia. */
export async function listModels(config: AiConfig): Promise<string[]> {
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { data?: { id?: unknown }[] };
    return [...new Set((data.data ?? []).map((item) => String(item.id ?? "")).filter(Boolean))].sort();
  } catch {
    return [];
  }
}
