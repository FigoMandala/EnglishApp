import { SCENARIOS } from "@/lib/tutor-scenarios";
import { requireUser } from "@/lib/session";

import { ScenarioPicker } from "./scenario-picker";

export const metadata = { title: "Skenario Tutor · EnglishApp" };

export default async function SkenarioPage() {
  await requireUser();
  return <ScenarioPicker scenarios={SCENARIOS} />;
}
