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
export function chatJsonRaw(config: AiConfig, messages: ProviderMessage[], timeoutMs = TIMEOUT_MS, extra: Record<string, unknown> = {}) {
  return chatCompletionRaw(config, messages, true, timeoutMs, extra);
}

/* ── Ketahanan: batas permintaan serentak + ulang otomatis saat provider menolak sementara ── */

let maxConcurrent = Number(process.env.AI_MAX_CONCURRENT ?? 0);
let active = 0;
const waiters: (() => void)[] = [];

/** Batasi jumlah panggilan AI yang berjalan bersamaan di proses ini (0 = tanpa batas). Provider menolak dengan 429 di atas batas aslinya. */
export function setAiConcurrency(limit: number) {
  maxConcurrent = Math.max(0, Math.floor(limit));
}

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  while (maxConcurrent > 0 && active >= maxConcurrent) await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
  try {
    return await task();
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
}

const RETRYABLE = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 6;

/** Ulangi permintaan yang ditolak sementara (429/502/503/504) dengan jeda eksponensial + jitter, selama anggaran waktu masih cukup. */
async function sendWithRetry(send: () => Promise<Response>, budgetMs: number): Promise<Response> {
  const startedAt = Date.now();
  for (let attempt = 0; ; attempt += 1) {
    const response = await send();
    if (!RETRYABLE.has(response.status) || attempt >= MAX_RETRIES) return response;
    const retryAfter = Number(response.headers.get("retry-after")) * 1000;
    const wait = Math.min(30_000, retryAfter || 1_500 * 2 ** attempt) + Math.random() * 1_000;
    if (Date.now() - startedAt + wait > budgetMs) return response;
    await response.arrayBuffer().catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

function chatCompletionRaw(
  config: AiConfig,
  messages: ProviderMessage[],
  jsonMode: boolean,
  timeoutMs = TIMEOUT_MS,
  extra: Record<string, unknown> = {},
): Promise<ChatResult> {
  return withSlot(() => chatCompletionRawOnce(config, messages, jsonMode, timeoutMs, extra));
}

async function chatCompletionRawOnce(
  config: AiConfig,
  messages: ProviderMessage[],
  jsonMode: boolean,
  timeoutMs = TIMEOUT_MS,
  extra: Record<string, unknown> = {},
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
        ...extra,
        ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(Math.max(1_000, timeoutMs - (Date.now() - startedAt))),
    });

  let response: Response;
  try {
    response = await sendWithRetry(() => send(jsonMode), timeoutMs);
    // Sebagian provider non-OpenAI menolak response_format. Coba lagi tanpa itu.
    if (jsonMode && response.status === 400) {
      const detail = await response.text().catch(() => "");
      if (/response_format/i.test(detail)) {
        console.warn(`[ai] provider menolak response_format, mencoba tanpa JSON mode: ${detail.slice(0, 120)}`);
        response = await sendWithRetry(() => send(false), timeoutMs);
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
 * `externalSignal` (mis. request.signal klien) digabung dengan timeout supaya
 * pembatalan klien ikut menghentikan panggilan provider.
 */
export async function chatCompletionStream(
  config: AiConfig,
  messages: ProviderMessage[],
  onDelta: (text: string) => void,
  externalSignal?: AbortSignal,
): Promise<ChatResult> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const startedAt = Date.now();
  const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);
  const signal = externalSignal ? AbortSignal.any([timeoutSignal, externalSignal]) : timeoutSignal;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages: foldSystemMessages(messages), stream: true }),
      signal,
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
