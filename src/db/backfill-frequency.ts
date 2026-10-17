import { and, count, eq, isNull, isNotNull } from "drizzle-orm";

import "./load-env";

import { db } from "./index";
import { vocabulary } from "./schema";
import { cefrForFrequencyRank, frequencyBand } from "@/lib/cefr";
import { loadFrequencyList } from "@/lib/vocabulary-frequency";

const LIMIT = Number(process.env.FREQ_LIMIT ?? 10000);

async function main() {
  const list = loadFrequencyList(LIMIT);
  const rankByWord = new Map(list.map((entry) => [entry.word.toLowerCase(), entry.rank]));
  console.log(`Daftar frekuensi: ${list.length} kata.`);

  const pending = await db
    .select({ id: vocabulary.id, wordLower: vocabulary.wordLower })
    .from(vocabulary)
    .where(isNull(vocabulary.frequencyRank));
  console.log(`Baris dengan frequencyRank kosong: ${pending.length}.`);

  let updated = 0;
  let unmatched = 0;

  for (const row of pending) {
    const rank = rankByWord.get(row.wordLower.toLowerCase());
    if (rank === undefined) {
      unmatched += 1;
      continue;
    }
    await db
      .update(vocabulary)
      .set({ frequencyRank: rank, cefr: cefrForFrequencyRank(rank) })
      .where(eq(vocabulary.id, row.id));
    updated += 1;
  }

  const [remaining] = await db
    .select({ n: count() })
    .from(vocabulary)
    .where(isNull(vocabulary.frequencyRank));

  console.log(`\nSelesai. Diperbarui ${updated} baris.`);
  console.log(`Tidak ketemu di daftar: ${unmatched}.`);
  console.log(`Sisa tanpa peringkat: ${remaining?.n ?? 0}.`);

  // Kata hasil generator frekuensi ("Frekuensi tinggi") level & CEFR-nya
  // selalu mengikuti rank — sinkronkan yang belum sesuai (mis. batch lama
  // yang masuk sebelum level diisi otomatis).
  const generated = await db
    .select({ id: vocabulary.id, frequencyRank: vocabulary.frequencyRank })
    .from(vocabulary)
    .where(
      and(eq(vocabulary.topic, "Frekuensi tinggi"), isNotNull(vocabulary.frequencyRank)),
    );
  let synced = 0;
  for (const row of generated) {
    const rank = row.frequencyRank ?? 0;
    await db
      .update(vocabulary)
      .set({ level: frequencyBand(rank), cefr: cefrForFrequencyRank(rank) })
      .where(eq(vocabulary.id, row.id));
    synced += 1;
  }
  console.log(`Disinkronkan level+CEFR ${synced} kata generator frekuensi.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });