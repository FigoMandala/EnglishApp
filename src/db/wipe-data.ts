import "./load-env";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { contentDb } from "@/db/content";

/**
 * Kosongkan SEMUA isi tabel (schema tetap) kecuali akun admin. TIDAK BISA DIKEMBALIKAN.
 * Bawaan dry-run (hanya menghitung); APPLY=1 baru menghapus. Dipertahankan: users role=admin,
 * app_config (pengaturan/key AI), __drizzle_migrations, sqlite_sequence.
 *   npm run db:wipe          lokal       |  npm run db:wipe:prod   online (Turso)
 */
const APPLY = process.env.APPLY === "1";
const KEEP = new Set(["__drizzle_migrations", "sqlite_sequence", "app_config", "users"]);
const host = (url?: string) => (url && !url.startsWith("file:") ? new URL(url).host : `lokal (${url ?? "file:./data/..."})`);

async function wipe(name: string, d: typeof db, url: string | undefined, withUsers: boolean) {
  console.log(`\n== ${name}: ${host(url)} ==`);
  const tables = (await d.all<{ name: string }>(sql`select name from sqlite_master where type='table' and name not like 'sqlite_%'`))
    .map((t) => t.name)
    .filter((t) => !KEEP.has(t));
  await d.run(sql`pragma foreign_keys = off`);
  for (const t of tables) {
    const n = (await d.all<{ n: number }>(sql.raw(`select count(*) n from "${t}"`)))[0].n;
    console.log(`${APPLY ? "hapus" : "akan hapus"} ${t}: ${n} baris`);
    if (APPLY && n) await d.run(sql.raw(`delete from "${t}"`));
  }
  if (withUsers) {
    const n = (await d.all<{ n: number }>(sql`select count(*) n from users where role <> 'admin'`))[0].n;
    console.log(`${APPLY ? "hapus" : "akan hapus"} users non-admin: ${n} baris (admin dipertahankan)`);
    if (APPLY) await d.run(sql`delete from users where role <> 'admin'`);
  }
}

async function main() {
  console.log(APPLY ? "MODE APPLY: menghapus." : "Dry-run: tidak menghapus. Tambah APPLY=1 untuk menghapus.");
  await wipe("app.db", db, process.env.DATABASE_URL, true);
  await wipe("content.db", contentDb as unknown as typeof db, process.env.CONTENT_DATABASE_URL, false);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
