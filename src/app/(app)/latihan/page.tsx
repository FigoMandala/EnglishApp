import { getSpeakingBest, listActivity } from "@/db/queries/activity";
import { mistakeGroups } from "@/db/queries/drills";
import { vocabularyStats } from "@/db/queries/vocabulary";
import { requireUser } from "@/lib/session";
import { SPEAKING_PROMPTS } from "@/lib/speaking-prompts";
import { normalizeSpeakingBest } from "@/lib/speaking-scores";

import { PracticeHub } from "./practice-hub";

export const metadata = { title: "Latihan Bebas · EnglishApp" };

export default async function LatihanPage() {
  const user = await requireUser();
  const [stats, mistakes, recent, storedSpeaking] = await Promise.all([
    vocabularyStats(user.id),
    mistakeGroups(user.id),
    listActivity(user.id, 3),
    getSpeakingBest(user.id),
  ]);

  const top = mistakes.groups[0] ?? null;
  const recommendations: { text: string; href: string }[] = [];
  if (stats.due > 0) recommendations.push({ text: `${stats.due} kartu kosakata jatuh tempo`, href: "/kosakata/review" });
  if (top) recommendations.push({ text: `${top.open} kesalahan di “${top.title}”`, href: "/latihan/kesalahan" });
  recommendations.push({ text: "12 soal grammar acak lintas materi", href: "/latihan/soal" });

  return (
    <PracticeHub
      dueCount={stats.due}
      openMistakes={mistakes.openTotal}
      topPattern={top ? { title: top.title, open: top.open } : null}
      recommendations={recommendations}
      recent={recent.map((row) => ({ id: row.id, detail: row.detail ?? row.kind }))}
      speakingBest={normalizeSpeakingBest(storedSpeaking, SPEAKING_PROMPTS.map((prompt) => prompt.id))}
    />
  );
}
