import { listDueCards } from "@/db/queries/vocabulary";
import { requireUser } from "@/lib/session";

import { ReviewSession } from "./review-session";

export const metadata = { title: "Review Kosakata · EnglishApp" };

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const requested = Number(params.n);
  const limit = Number.isInteger(requested) && requested > 0 && requested <= 60 ? requested : 20;

  const cards = await listDueCards(user.id, limit);

  return (
    <ReviewSession
      cards={cards.map((card) => ({
        id: card.id,
        word: card.word,
        meaning: card.meaning,
        phonetic: card.phonetic,
        partOfSpeech: card.partOfSpeech,
        exampleEn: card.exampleEn,
        exampleId: card.exampleId,
        mnemonic: card.mnemonic,
        box: card.box,
      }))}
    />
  );
}
