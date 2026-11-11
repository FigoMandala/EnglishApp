import { lt, sql } from "drizzle-orm";

import "./load-env";

import { db } from "@/db";
import { ttsCache } from "@/db/schema";

/**
 * Membersihkan cache audio TTS (`tts_cache`, base64 di database) supaya tidak membengkak seiring Listening diputar.
 * Cache hanya mempercepat; audio yang terhapus dibuat ulang saat diputar lagi. Bawaan dry-run.
 *
 *   KEEP_DAYS=30   hapus audio yang lebih tua dari ini (bawaan 30)
 *   MAX_MB=500     setelah itu, hapus yang terlama sampai total di bawah ini (bawaan tanpa batas)
 *   APPLY=1        benar-benar menghapus
 */
const KEEP_DAYS = Number(process.env.KEEP_DAYS ?? 30);
const MAX_MB = process.env.MAX_MB ? Number(process.env.MAX_MB) : Infinity;
const APPLY = process.env.APPLY === "1";

const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1);

async function totals() {
  const [row] = await db
    .select({ n: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(length(${ttsCache.audio})), 0)` })
    .from(ttsCache);
  return { n: Number(row?.n ?? 0), bytes: Number(row?.bytes ?? 0) };
}

async function main() {
  const before = await totals();
  console.log(`Cache TTS: ${before.n} audio, ${mb(before.bytes)} MB. ${APPLY ? "MENGHAPUS" : "dry-run (tambahkan APPLY=1 untuk menghapus)"}.`);

  const cutoff = sql`datetime('now', ${`-${KEEP_DAYS} days`})`;
  const [old] = await db
    .select({ n: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(length(${ttsCache.audio})), 0)` })
    .from(ttsCache)
    .where(lt(ttsCache.createdAt, cutoff));
  console.log(`Lebih tua dari ${KEEP_DAYS} hari: ${old?.n ?? 0} audio, ${mb(Number(old?.bytes ?? 0))} MB.`);
  if (APPLY) await db.delete(ttsCache).where(lt(ttsCache.createdAt, cutoff));

  if (Number.isFinite(MAX_MB)) {
    let { bytes } = await totals();
    while (bytes > MAX_MB * 1_048_576) {
      const oldest = await db.select({ key: ttsCache.key, size: sql<number>`length(${ttsCache.audio})` }).from(ttsCache).orderBy(ttsCache.createdAt).limit(200);
      if (!oldest.length) break;
      const freed = oldest.reduce((sum, row) => sum + Number(row.size), 0);
      console.log(`Di atas ${MAX_MB} MB: ${APPLY ? "menghapus" : "akan menghapus"} ${oldest.length} audio terlama (${mb(freed)} MB).`);
      if (!APPLY) break;
      for (const row of oldest) await db.delete(ttsCache).where(sql`${ttsCache.key} = ${row.key}`);
      bytes -= freed;
    }
  }

  const after = await totals();
  console.log(`Sesudah: ${after.n} audio, ${mb(after.bytes)} MB.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
