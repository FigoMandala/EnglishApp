import { leagueBoard } from "@/db/queries/league";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";

import { LeagueView } from "./league-view";

export const metadata = { title: "Liga mingguan · EnglishApp" };

export default async function LigaPage() {
  const user = await requireUser();
  const board = await leagueBoard(user.id, todayISO());
  return <LeagueView {...board} />;
}
