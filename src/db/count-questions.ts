import "./load-env";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { contentDb } from "@/db/content";

/** Hitung jumlah soal. Lokal: `npm run db:count`; online: `npm run db:count:prod`. Hanya SELECT. */
const where = (url?: string) => (url?.startsWith("file:") || !url ? `lokal (${url ?? "file:./data/..."})` : `online (${new URL(url).host})`);

async function main() {
  console.log("app.db     :", where(process.env.DATABASE_URL));
  console.table(await db.all(sql`select track, kind, count(*) item, sum(question_count) soal from question_bank group by 1, 2`));
  console.log("grammar_exercises:", (await db.all<{ n: number }>(sql`select count(*) n from grammar_exercises`))[0].n);

  console.log("content.db :", where(process.env.CONTENT_DATABASE_URL));
  console.log("listening_questions:", (await contentDb.all<{ n: number }>(sql`select count(*) n from listening_questions`))[0].n);
}

// exitCode, bukan process.exit(): di Windows exit paksa memicu assertion libuv saat koneksi Turso masih terbuka.
main().catch((e) => { console.error(e); process.exitCode = 1; });
