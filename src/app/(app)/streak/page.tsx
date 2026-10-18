import { getStreakState } from "@/db/queries/streak";
import { requireUser } from "@/lib/session";
import { shiftDate, todayISO } from "@/lib/srs";
import { timeLeftToday } from "@/lib/streak";

import { StreakView } from "./streak-view";

export const metadata = { title: "Streak · EnglishApp" };

export default async function StreakPage() {
  const user = await requireUser();
  const today = todayISO();
  const state = await getStreakState(user.id, today);

  // Kalender bulan berjalan, dimulai Senin.
  const monthStart = `${today.slice(0, 8)}01`;
  const dow = new Date(`${monthStart}T00:00:00Z`).getUTCDay();
  const lead = (dow + 6) % 7;
  const daysInMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  const monthName = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${monthStart}T00:00:00Z`),
  );

  const studied = new Set(state.studied);
  const frozen = new Set(state.frozen);
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = shiftDate(monthStart, i);
    return {
      n: i + 1,
      date,
      status: frozen.has(date) ? ("frozen" as const) : studied.has(date) ? ("studied" as const) : ("empty" as const),
      future: date > today,
      today: date === today,
    };
  });

  return (
    <StreakView
      streak={state.streak}
      longest={state.longest}
      freezes={state.freezes}
      studiedToday={state.studiedToday}
      frozenToday={frozen.has(today)}
      weekendEasy={state.weekendEasy}
      monthName={monthName}
      lead={lead}
      days={days}
      left={timeLeftToday()}
    />
  );
}
