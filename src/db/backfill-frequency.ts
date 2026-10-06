import { count, eq, isNull } from "drizzle-orm";

import "./load-env";

import { db } from "./index";
import { vocabulary } from "./schema";
import { loadFrequencyList } from "@/lib/vocabulary-frequency";

const LIMIT = Number(process.env.FREQ_LIMIT ?? 10000);

/** Band CEFR dari peringkat frekuensi: makin sering dipakai, makin dasar. */
function cefrForRank(rank: number): "A2" | "B1" | "B2" {
  if (rank <= 1000) return "A2";
  if (rank <= 2500) return "B1";
  return "B2";
}

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
      .set({ frequencyRank: rank, cefr: cefrForRank(rank) })
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });