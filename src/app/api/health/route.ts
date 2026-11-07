import { sql } from "drizzle-orm";

import { db } from "@/db";
import { aiConfigured, getAiConfig } from "@/lib/ai-config";

/**
 * Health check ringan untuk uptime monitor (UptimeRobot dsb.). Hanya
 * membocorkan status boolean, bukan detail konfigurasi.
 */
export async function GET() {
  let dbUp = false;
  try {
    await db.run(sql`select 1`);
    dbUp = true;
  } catch {
    dbUp = false;
  }
  let ai = false;
  try {
    ai = aiConfigured(await getAiConfig());
  } catch {
    ai = false;
  }
  return Response.json(
    { ok: dbUp, db: dbUp ? "up" : "down", ai: ai ? "configured" : "off", time: new Date().toISOString() },
    { status: dbUp ? 200 : 503 },
  );
}
