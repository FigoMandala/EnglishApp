import { createClient } from "@libsql/client";

/**
 * Salin bank soal EPrT dari DB lokal ke DB online (DATABASE_URL di env).
 * Hanya menambah: baris dengan fingerprint yang sudah ada di online dilewati, tidak ada yang dihapus/ditimpa.
 *   node --env-file=.env.production.local --import tsx src/db/push-bank.ts
 */
const remoteUrl = process.env.DATABASE_URL;
if (!remoteUrl?.startsWith("libsql://")) {
  console.error("DATABASE_URL harus DB online (libsql://). Jalankan lewat npm run db:push-bank.");
  process.exit(1);
}
const local = createClient({ url: "file:./data/app.db" });
const remote = createClient({ url: remoteUrl, authToken: process.env.DATABASE_AUTH_TOKEN?.trim() });

const BATCH = 50;

async function main() {
  const rows = (await local.execute("SELECT track, kind, level_band, fingerprint, skill, question_count, item FROM question_bank WHERE track = 'eptr'")).rows;
  console.log(`Lokal: ${rows.length} item.`);
  let added = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const results = await remote.batch(
      chunk.map((r) => ({
        sql: "INSERT OR IGNORE INTO question_bank (track, kind, level_band, fingerprint, skill, question_count, item) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [r.track, r.kind, r.level_band, r.fingerprint, r.skill, r.question_count, r.item] as never[],
      })),
      "write",
    );
    added += results.reduce((sum, result) => sum + result.rowsAffected, 0);
    if ((i / BATCH) % 10 === 0) console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}; ditambah ${added}`);
  }
  console.log(`Selesai. Ditambah ${added} item ke online (${rows.length - added} sudah ada).`);
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
