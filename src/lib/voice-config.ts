import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { appConfig } from "@/db/schema";
import { parsePrefs, type VoicePrefs } from "@/lib/voices";

const VOICE_CONFIG_KEY = "voice_config";

/** Pengaturan suara Listening untuk semua pengguna (diatur admin). */
export async function getVoiceConfig(): Promise<VoicePrefs> {
  const [row] = await db.select().from(appConfig).where(eq(appConfig.key, VOICE_CONFIG_KEY)).limit(1);
  return parsePrefs(row?.value);
}

export async function setVoiceConfig(prefs: VoicePrefs) {
  const json = JSON.stringify(parsePrefs(JSON.stringify(prefs)));
  await db
    .insert(appConfig)
    .values({ key: VOICE_CONFIG_KEY, value: json })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { value: json, updatedAt: sql`(datetime('now'))` },
    });
}
