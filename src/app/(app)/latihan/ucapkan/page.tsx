import { randomVocabulary } from "@/db/queries/drills";
import { getSpeakingBest } from "@/db/queries/activity";
import { requireUser } from "@/lib/session";
import { SPEAKING_PROMPTS } from "@/lib/speaking-prompts";
import { normalizeSpeakingBest } from "@/lib/speaking-scores";

import { SpeakingSession } from "./speaking-session";
import type { SpeakingItem } from "./speaking-drill";

export const metadata = { title: "Ucapkan · EnglishApp" };

const ROUNDS = 6;

export default async function UcapkanPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const user = await requireUser();
  const [{ topic }, words, stored] = await Promise.all([
    searchParams,
    randomVocabulary(ROUNDS, { withExample: true }),
    getSpeakingBest(user.id),
  ]);
  const items: SpeakingItem[] = words.map((word) => ({
    id: word.id,
    sentence: word.exampleEn ?? word.word,
    translation: word.exampleId,
    focus: word.word,
    phonetic: word.phonetic,
  }));
  const best = normalizeSpeakingBest(stored, SPEAKING_PROMPTS.map((prompt) => prompt.id));

  return <SpeakingSession vocab={items} best={best} initialTopicId={topic} />;
}
