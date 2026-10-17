import "./load-env";

/**
 * Bersihkan review lama yang menumpuk: sebelum adanya dedup di recordResult,
 * menjawab soal yang sama salah berkali-kali membuat baris review baru setiap
 * kali. Skrip ini menggabungkan baris-baris dengan soal (fingerprint) sama ke
 * satu review terbaik, lalu menghapus sisanya.
 *
 * Aturan gabungan per grup fingerprint:
 * - Simpan review dengan dueAt paling dekat (paling jatuh tempo).
 * - box = maksimum semua box di grup (progres SRS terbaik tidak hilang).
 * - dueAt = minimum (yang paling dekat menang), tapi tidak sebelum hari ini
 *   kalau grup punya box > 0... sebenarnya sederhananya: pakai dueAt terkecil
 *   apa adanya supaya soal yang memang jatuh tempo tetap muncul.
 *
 * Jalankan: npm run db:dedup-reviews (idempoten; jalankan ulang aman).
 */

import { eq } from "drizzle-orm";

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
  const rows = await db.select().from(toeflReviews).orderBy(toeflReviews.userId, toeflReviews.id);
  console.log(`Total review: ${rows.length}`);

  // Kelompokkan per user + fingerprint soal.
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const fp = rowFingerprint(row.question);
    if (!fp) continue;
    const key = `${row.userId}:${fp}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const duplicates = [...groups.values()].filter((group) => group.length > 1);
  if (!duplicates.length) {
    console.log("Tidak ada duplikat. Selesai.");
    return;
  }

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
    `Ditemukan ${duplicates.length} grup duplikat. Dihapus ${removed} baris, tersimpan ${duplicates.length} review terbaik per soal.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
