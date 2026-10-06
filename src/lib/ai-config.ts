import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { appConfig } from "@/db/schema";

const AI_CONFIG_KEY = "ai_config";

const DEFAULT_BASE_URL = "https://api.kryptonlab.id/v1";
const DEFAULT_MODEL = "gemini-3.8-flash";

export type AiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type StoredAiConfig = { baseUrl?: string; apiKey?: string; model?: string };

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
  };
}

export async function setAiConfig(values: Partial<AiConfig>) {
  const current = await getAiConfig();
  const next = {
    baseUrl: values.baseUrl?.trim() || current.baseUrl,
    apiKey: values.apiKey?.trim() || current.apiKey,
    model: values.model?.trim() || current.model,
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
