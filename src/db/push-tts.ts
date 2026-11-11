import { readdirSync, readFileSync } from "node:fs";

import { createClient } from "@libsql/client";

/**
 * Masukkan audio dari tools/modal-drama3/out-kokoro ke tabel tts_pregen di DB target (DATABASE_URL, bawaan lokal).
 * Nama file = kuncinya (sha256 suara+teks). Hanya menambah; yang sudah ada dilewati.
 *   npm run db:push-tts            # lokal
 *   npm run db:push-tts:prod       # online
 */
const DIR = "tools/modal-drama3/out-kokoro";
const url = process.env.DATABASE_URL ?? "file:./data/app.db";
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN?.trim() });

async function main() {
  const files = readdirSync(DIR).filter((name) => name.endsWith(".mp3"));
  console.log(`${files.length} file audio -> ${url.startsWith("libsql") ? "DB online" : url}`);
  let added = 0;
  let batch: { sql: string; args: [string, Buffer] }[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    const results = await client.batch(batch, "write");
    added += results.reduce((sum, result) => sum + result.rowsAffected, 0);
    batch = [];
    bytes = 0;
  };
  for (const [i, name] of files.entries()) {
    const audio = readFileSync(`${DIR}/${name}`);
    batch.push({ sql: "INSERT OR IGNORE INTO tts_pregen (key, audio) VALUES (?, ?)", args: [name.slice(0, -4), audio] });
    bytes += audio.length;
    // Batas ukuran per permintaan supaya tidak ditolak server.
    if (batch.length >= 40 || bytes > 2_000_000) await flush();
    if (i % 500 === 0) console.log(`  ${i}/${files.length}; ditambah ${added}`);
  }
  await flush();
  console.log(`Selesai. Ditambah ${added} audio (${files.length - added} sudah ada).`);
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
