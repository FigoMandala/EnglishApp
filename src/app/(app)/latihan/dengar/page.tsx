import { randomVocabulary } from "@/db/queries/drills";
import { requireUser } from "@/lib/session";

import { ListeningDrill, type ListeningItem } from "./listening-drill";

export const metadata = { title: "Dengar & jawab · EnglishApp" };

const ROUNDS = 8;

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default async function DengarPage() {
  await requireUser();
  const targets = await randomVocabulary(ROUNDS, { withExample: true });
  const pool = await randomVocabulary(40);

  const items: ListeningItem[] = targets.map((word) => {
    const distractors = pool.filter((p) => p.id !== word.id && p.wordLower !== word.wordLower).slice(0, 3);
    return {
      id: word.id,
      sentence: word.exampleEn ?? word.word,
      translation: word.exampleId,
      answer: word.word,
      meaning: word.meaning,
      options: shuffle([word.word, ...distractors.map((d) => d.word)]),
    };
  });

  return <ListeningDrill items={items} />;
}
