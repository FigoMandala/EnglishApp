import { randomVocabulary } from "@/db/queries/drills";
import { requireUser } from "@/lib/session";

import { SpeakingDrill, type SpeakingItem } from "./speaking-drill";

export const metadata = { title: "Ucapkan · EnglishApp" };

const ROUNDS = 6;

export default async function UcapkanPage() {
  await requireUser();
  const words = await randomVocabulary(ROUNDS, { withExample: true });
  const items: SpeakingItem[] = words.map((word) => ({
    id: word.id,
    sentence: word.exampleEn ?? word.word,
    translation: word.exampleId,
    focus: word.word,
    phonetic: word.phonetic,
  }));
  return <SpeakingDrill items={items} />;
}
