import "./load-env";

/**
 * Rawat baris review EPrT:
 * 1. Isi kolom `fingerprint` untuk baris lama yang masih null.
 * 2. Gabungkan baris dengan soal (fingerprint) sama ke satu review terbaik,
 *    lalu hapus sisanya.
 * 3. Pasang unique index (user + fingerprint) supaya race dua jawaban salah
 *    paralel tidak bisa membuat baris dobel lagi. Idempoten; jalankan ulang aman.
 *
 * Aturan gabungan per grup fingerprint:
 * - Simpan review dengan dueAt paling dekat (paling jatuh tempo).
 * - box = maksimum semua box di grup (progres SRS terbaik tidak hilang).
 *
 * Jalankan: npm run db:dedup-reviews
 */

import { eq, isNull, sql } from "drizzle-orm";

import { db } from "./index";
import { toeflReviews } from "./schema";
import { fingerprint, questionText } from "@/lib/question-variety";
import { parseQuestions } from "@/lib/toefl";

function rowFingerprint(questionJson: string): string | null {
  const parsed = parseQuestions(questionJson);
  if (!parsed.length) return null;
  return fingerprint(questionText(parsed[0]));
}

async function main() {
  // 1) Backfill sidik jari baris lama.
  const pending = await db
    .select({ id: toeflReviews.id, question: toeflReviews.question })
    .from(toeflReviews)
    .where(isNull(toeflReviews.fingerprint));
  let filled = 0;
  for (const row of pending) {
    const fp = rowFingerprint(row.question);
    if (!fp) continue;
    await db.update(toeflReviews).set({ fingerprint: fp }).where(eq(toeflReviews.id, row.id));
    filled += 1;
  }
  if (filled > 0) console.log(`Sidik jari diisi untuk ${filled} baris lama.`);

  // 2) Dedup per user + fingerprint.
  const rows = await db.select().from(toeflReviews).orderBy(toeflReviews.userId, toeflReviews.id);
  console.log(`Total review: ${rows.length}`);

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.fingerprint) continue;
    const key = `${row.userId}:${row.fingerprint}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const duplicates = [...groups.values()].filter((group) => group.length > 1);
  let removed = 0;
  for (const group of duplicates) {
    // Simpan baris dengan dueAt paling dekat (id terkecil sebagai tie-break).
    const sorted = [...group].sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id - b.id);
    const keep = sorted[0];
    const maxBox = Math.max(...group.map((row) => row.box));

    // box tersimpan tidak boleh lebih rendah dari progres terbaik grup.
    if (maxBox > keep.box) {
      await db.update(toeflReviews).set({ box: maxBox }).where(eq(toeflReviews.id, keep.id));
    }
    for (const row of sorted.slice(1)) {
      await db.delete(toeflReviews).where(eq(toeflReviews.id, row.id));
      removed += 1;
    }
  }
  console.log(
    duplicates.length
      ? `Ditemukan ${duplicates.length} grup duplikat. Dihapus ${removed} baris.`
      : "Tidak ada duplikat.",
  );

  // 3) Unique index (baris fingerprint null tidak saling bentrok di SQLite).
  await db.run(
    sql`create unique index if not exists toefl_reviews_user_fp_unique on toefl_reviews (user_id, fingerprint)`,
  );
  console.log("Unique index toefl_reviews_user_fp_unique siap.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
