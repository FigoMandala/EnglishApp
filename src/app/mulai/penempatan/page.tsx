import { redirect } from "next/navigation";

import { placementQuestions } from "@/db/queries/onboarding";

import { PlacementTest } from "./placement-test";

export const dynamic = "force-dynamic";

export default async function PenempatanPage() {
  const questions = await placementQuestions();
  // Tanpa soal di bank, lewati langsung ke hasil (memakai level pilihan sendiri).
  if (questions.length === 0) redirect("/mulai/hasil");
  return <PlacementTest questions={questions} />;
}
