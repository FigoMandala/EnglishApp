import { dueForecast, listDueCards } from "@/db/queries/vocabulary";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";

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

  const [cards, forecast] = await Promise.all([
    listDueCards(user.id, limit),
    dueForecast(user.id, todayISO(), 7),
  ]);

  return (
    <ReviewSession
      forecast={forecast}
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
