import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getScenario } from "@/lib/tutor-scenarios";
import { requireUser } from "@/lib/session";

import { TutorChat } from "../../tutor-chat";

export const metadata = { title: "Skenario Tutor · EnglishApp" };

export default async function ScenarioSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { c } = await searchParams;
  const scenario = getScenario(id);
  if (!scenario) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/tutor/skenario"
        className="flex min-h-11 w-fit items-center gap-1.5 text-[0.9375rem] font-extrabold text-ink-subtle hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Ganti skenario
      </Link>
      <TutorChat
        key={scenario.id}
        scenario={{ id: scenario.id, title: scenario.title, persona: scenario.persona }}
        correction={c === "end" ? "end" : "live"}
        initialMessages={[{ role: "assistant", content: scenario.opener }]}
        suggestions={["Kasih contoh jawaban", "Artinya apa?", "Ulangi lebih pelan"]}
      />
    </div>
  );
}
