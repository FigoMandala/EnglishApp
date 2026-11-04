import { daysBetween } from "./dates";

export type WordStatus =
  | { kind: "new"; label: "Baru" }
  | { kind: "due"; label: "Jatuh tempo" }
  | { kind: "mastered"; label: "Dikuasai" }
  | { kind: "later"; label: string };

/** Status kartu SRS untuk chip: baru, jatuh tempo, dikuasai, atau "dalam N hari". */
export function wordStatus(card: { box: number; dueAt: string | null; lastReviewedAt: string | null }, today: string): WordStatus {
  if (!card.lastReviewedAt) return { kind: "new", label: "Baru" };
  if (card.dueAt && card.dueAt.slice(0, 10) <= today) return { kind: "due", label: "Jatuh tempo" };
  if (card.box >= 5) return { kind: "mastered", label: "Dikuasai" };
  const days = card.dueAt ? daysBetween(today, card.dueAt.slice(0, 10)) : 0;
  return { kind: "later", label: days <= 1 ? "besok" : `dalam ${days} hari` };
}
