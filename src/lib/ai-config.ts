import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { appConfig } from "@/db/schema";

const AI_CONFIG_KEY = "ai_config";

const DEFAULT_BASE_URL = "https://api.kryptonlab.id/v1";
const DEFAULT_MODEL = "gpt-6-luna";

export type AiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Model pemeriksa soal (opsional). Kosong = pakai `model`. Beda model menangkap kesalahan yang konsisten. */
  verifyModel?: string;
  /** Mode berpikir model penalar. Kosong = mati (tidak dikirim ke penyedia). */
  reasoningEffort?: ReasoningEffort;
};

export const REASONING_EFFORTS = ["low", "medium", "high"] as const;
export type ReasoningEffort = "" | (typeof REASONING_EFFORTS)[number];

const asEffort = (value: unknown): ReasoningEffort =>
  (REASONING_EFFORTS as readonly string[]).includes(String(value)) ? (value as ReasoningEffort) : "";

/** Parameter tambahan untuk chatJsonRaw; kosong kalau reasoning mati. */
export const reasoningExtra = (config: AiConfig): Record<string, unknown> =>
  config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {};

type StoredAiConfig = { baseUrl?: string; apiKey?: string; model?: string; verifyModel?: string; reasoningEffort?: string };

export async function getAiConfig(): Promise<AiConfig> {
  const [row] = await db.select().from(appConfig).where(eq(appConfig.key, AI_CONFIG_KEY)).limit(1);
  let stored: StoredAiConfig | null = null;
  if (row) {
    try {
      stored = JSON.parse(row.value) as StoredAiConfig;
    } catch {
      stored = null;
    }
  }

  return {
    baseUrl: stored?.baseUrl?.trim() || process.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL,
    apiKey: stored?.apiKey?.trim() || process.env.AI_API_KEY?.trim() || "",
    model: stored?.model?.trim() || DEFAULT_MODEL,
    verifyModel: stored?.verifyModel?.trim() || "",
    reasoningEffort: asEffort(stored?.reasoningEffort),
  };
}

/**
 * Validasi baseUrl AI dari form admin. Key API dikirim sebagai Bearer header
 * ke host ini, jadi nilai yang tidak divalidasi menjadi saluran eksfiltrasi
 * kredensial (audit keamanan P2): wajib https, tanpa userinfo, dan bukan
 * host internal. Mengembalikan pesan galat atau null.
 */
export function aiBaseUrlError(rawBaseUrl: string): string | null {
  const value = rawBaseUrl.trim();
  if (!value) return null; // kosong = pertahankan nilai lama
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Base URL AI tidak valid (harus URL https lengkap).";
  }
  if (url.protocol !== "https:") return "Base URL AI wajib https://";
  if (url.username || url.password) return "Base URL AI tidak boleh memuat kredensial di URL.";
  const host = url.hostname.toLowerCase();
  const privateLike =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local");
  const ipLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  // IP literal: hanya publik yang lewat (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x ditolak).
  if (privateLike || (ipLiteral && !isPublicIpv4(host))) {
    return "Base URL AI tidak boleh mengarah ke host internal.";
  }
  if (value.length > 300) return "Base URL AI terlalu panjang.";
  return null;
}

function isPublicIpv4(host: string) {
  const parts = host.split(".").map(Number);
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  return true;
}

export async function setAiConfig(values: Partial<AiConfig>) {
  const current = await getAiConfig();
  const baseUrlError = aiBaseUrlError(values.baseUrl ?? "");
  if (baseUrlError) throw new Error(baseUrlError);
  const next = {
    baseUrl: values.baseUrl?.trim() || current.baseUrl,
    apiKey: values.apiKey?.trim() || current.apiKey,
    model: values.model?.trim() || current.model,
    // Beda dengan kolom lain: kosong berarti sengaja dikosongkan (pakai model yang sama).
    verifyModel: values.verifyModel === undefined ? current.verifyModel : values.verifyModel.trim(),
    reasoningEffort: values.reasoningEffort === undefined ? current.reasoningEffort : asEffort(values.reasoningEffort),
  };
  const json = JSON.stringify(next);
  await db
    .insert(appConfig)
    .values({ key: AI_CONFIG_KEY, value: json })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { value: json, updatedAt: sql`(datetime('now'))` },
    });
  return next;
}

export function aiConfigured(config: AiConfig) {
  return Boolean(config.baseUrl && config.apiKey && config.model);
}
