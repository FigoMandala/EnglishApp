import { aiConfigured, getAiConfig } from "@/lib/ai-config";
import { loadSimulation, simulationHistory } from "@/lib/api/eprt-simulation";
import { loadSession, toeflOverview } from "@/lib/api/toefl-turn";
import { daysBetween } from "@/lib/dates";
import { scopeQuestionTotal } from "@/lib/eprt-simulation";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";
import { SKILLS } from "@/lib/toefl";
import { getVoiceConfig } from "@/lib/voice-config";

import { ToeflRunner } from "../toefl/toefl-runner";
import { EprtHome } from "./eprt-home";

export const maxDuration = 300;

const MIN_SKILL_ANSWERS = 3;

const SCOPE_LABEL = { listening: "Listening", structure: "Structure", reading: "Reading" } as const;

export default async function EptrPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const sessionId = Number(params.s);
  const hasSession = Number.isInteger(sessionId) && sessionId > 0;

  const [config, overview, session, simulations] = await Promise.all([
    getAiConfig(),
    toeflOverview(user.id, today, "eptr"),
    hasSession ? loadSession(user.id, sessionId) : Promise.resolve(null),
    simulationHistory(user.id),
  ]);

  if (session) {
    return <ToeflRunner session={session} basePath="/eptr" voice={await getVoiceConfig()} />;
  }

  const running = simulations.find((sim) => !sim.completed);
  const active = running ? await loadSimulation(user.id, running.id) : null;
  const weakest = overview.stats
    .filter((stat) => stat.pct !== null && stat.answered >= MIN_SKILL_ANSWERS)
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0];

  return (
    <EprtHome
      username={user.displayName ?? user.username}
      configured={aiConfigured(config)}
      daysToTest={overview.target?.testDate ? daysBetween(today, overview.target.testDate) : null}
      target={overview.target}
      estimate={overview.estimate?.total ?? null}
      trend={overview.trend.slice(-10).map((point) => point.total)}
      week={overview.week}
      streak={overview.streak}
      reviewsDue={overview.reviews.due}
      weakest={
        weakest
          ? { label: SKILLS[weakest.skill].label, pct: weakest.pct ?? 0, answered: weakest.answered }
          : null
      }
      activeSim={
        active
          ? {
              id: active.id,
              doneParts: active.parts.filter((part) => part.status === "done").length,
              scope: active.scope,
              totalParts: active.parts.length,
              nextTitle: active.parts.find((part) => part.status !== "done")?.title ?? null,
              doneQuestions: active.parts.reduce(
                (sum, part) => sum + (part.status === "done" ? part.count : part.answered),
                0,
              ),
              totalQuestions: scopeQuestionTotal(active.scope),
            }
          : null
      }
      simulations={simulations.slice(0, 6).map((sim) => ({
        id: sim.id,
        createdAt: sim.createdAt,
        scope: sim.scope,
        partTotal: sim.partTotal,
        completed: sim.completed,
        // Mini-test menampilkan skor section (31-68); simulasi penuh skor total.
        total: sim.score && sim.scope ? sim.score[sim.scope] : sim.total,
        sections: sim.score
          ? sim.scope
            ? SCOPE_LABEL[sim.scope]
            : `L ${sim.score.listening} · S ${sim.score.structure} · R ${sim.score.reading}`
          : null,
        started: sim.started,
      }))}
      topics={overview.stats
        .filter((stat) => SKILLS[stat.skill].section !== "listening")
        .map((stat) => ({
          skill: stat.skill,
          section: SKILLS[stat.skill].section as "structure" | "reading",
          label: SKILLS[stat.skill].label,
          hint: SKILLS[stat.skill].hint,
          answered: stat.answered,
          pct: stat.pct,
        }))}
      practice={overview.history}
    />
  );
}
