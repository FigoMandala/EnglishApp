import { randomVocabulary } from "@/db/queries/drills";
import { requireUser } from "@/lib/session";

import { PairsDrill, type Pair } from "./pairs-drill";

export const metadata = { title: "Cocokkan pasangan · EnglishApp" };

const PAIRS = 6;

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default async function PasanganPage() {
  await requireUser();
  const words = await randomVocabulary(PAIRS * 2);
  // Hindari arti yang sama atau terlalu panjang supaya kartu tetap terbaca.
  const seen = new Set<string>();
  const pairs: Pair[] = [];
  for (const word of words) {
    const meaning = word.meaning.trim();
    if (meaning.length > 40 || seen.has(meaning.toLowerCase())) continue;
    seen.add(meaning.toLowerCase());
    pairs.push({ id: word.id, word: word.word, meaning });
    if (pairs.length === PAIRS) break;
  }
  return <PairsDrill pairs={pairs} rightOrder={shuffle(pairs.map((p) => p.id))} />;
}
