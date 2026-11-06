import { inArray } from "drizzle-orm";

import "./load-env";

import { db } from "./index";
import { vocabulary } from "./schema";
import { isVowellessWord } from "@/lib/vocabulary-frequency";

/**
 * Hapus kata sampah dari database: satu token huruf tanpa vokal sama sekali
 * (sbjct, html, xnxx, dll). Kata Inggris sungguhan selalu mengandung vokal;
 * y tetap dihitung sebagai vokal (gym, shy, rhythm).
 *
 * Default dry-run: hanya menampilkan daftarnya. Jalankan ulang dengan --delete
 * untuk benar-benar menghapus (progress SRS terkait ikut lewat cascade).
 */
const DELETE = process.argv.includes("--delete");

async function main() {
  const rows = await db
    .select({
      id: vocabulary.id,
      word: vocabulary.word,
      topic: vocabulary.topic,
      frequencyRank: vocabulary.frequencyRank,
    })
    .from(vocabulary);

  const junk = rows.filter((row) => isVowellessWord(row.word.trim().toLowerCase()));
  if (junk.length === 0) {
    console.log("Tidak ada kata tanpa vokal. Database bersih.");
    return;
  }

  console.log(`Ditemukan ${junk.length} kata tanpa vokal:`);
  for (const row of junk) {
    console.log(`- ${row.word} (topik: ${row.topic ?? "-"}, rank: ${row.frequencyRank ?? "-"})`);
  }

  if (!DELETE) {
    console.log("\nDry-run saja. Jalankan ulang dengan --delete untuk menghapus.");
    return;
  }

  await db.delete(vocabulary).where(inArray(vocabulary.id, junk.map((row) => row.id)));
  console.log(`\nTerhapus ${junk.length} kata. Progress SRS terkait ikut terhapus otomatis.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
