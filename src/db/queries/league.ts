import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { userSettings, users, xpEvents } from "@/db/schema";
import { getSetting, setSetting } from "@/db/queries/activity";
import { rankRows, tierIndexForXp, weekBounds, type LeagueRow } from "@/lib/league";

export const LEAGUE_OPT_IN_KEY = "league_opt_in";
const MAX_ROWS = 30;

export const getLeagueOptIn = (userId: number) => getSetting<boolean>(userId, LEAGUE_OPT_IN_KEY, false);
export const setLeagueOptIn = (userId: number, on: boolean) => setSetting(userId, LEAGUE_OPT_IN_KEY, on);

async function xpSums(range?: { start: string; end: string }, userIds?: number[]) {
  const conditions = [
    range ? sql`${xpEvents.date} >= ${range.start} and ${xpEvents.date} <= ${range.end}` : undefined,
    userIds ? inArray(xpEvents.userId, userIds) : undefined,
  ];
  const rows = await db
    .select({ userId: xpEvents.userId, n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(and(...conditions))
    .groupBy(xpEvents.userId);
  return new Map(rows.map((row) => [row.userId, Number(row.n)]));
}

/**
 * Papan liga mingguan. Hanya pengguna yang ikut liga (opt-in) yang terlihat orang lain;
 * liga = pengguna opt-in dengan tingkat (dari level) yang sama.
 */
export async function leagueBoard(userId: number, today: string) {
  const week = weekBounds(today);
  const [optIn, myWeek, myLastWeek, myTotal] = await Promise.all([
    getLeagueOptIn(userId),
    xpSums(week, [userId]),
    xpSums({ start: week.prevStart, end: week.prevEnd }, [userId]),
    xpSums(undefined, [userId]),
  ]);
  const tier = tierIndexForXp(myTotal.get(userId) ?? 0);
  const base = { optIn, tier, weekXp: myWeek.get(userId) ?? 0, lastWeekXp: myLastWeek.get(userId) ?? 0, end: week.end };
  if (!optIn) return { ...base, rows: [] as LeagueRow[], rank: null as number | null, next: null as { name: string; gap: number } | null };

  const optedIn = await db
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(and(eq(userSettings.key, LEAGUE_OPT_IN_KEY), eq(userSettings.value, "true")));
  const ids = [...new Set([...optedIn.map((row) => row.userId), userId])];

  const totals = await xpSums(undefined, ids);
  const sameTier = ids.filter((id) => tierIndexForXp(totals.get(id) ?? 0) === tier);
  const [weekly, people] = await Promise.all([
    xpSums(week, sameTier),
    db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, sameTier)),
  ]);

  const all = rankRows(
    people.map((person) => ({
      userId: person.id,
      name: person.displayName ?? person.username,
      xp: weekly.get(person.id) ?? 0,
      isMe: person.id === userId,
    })),
  );
  const myIndex = all.findIndex((row) => row.isMe);
  const rows = all.slice(0, MAX_ROWS);
  if (myIndex >= MAX_ROWS) rows.push(all[myIndex]);
  // Target "salip" = baris terdekat di atas dengan XP lebih besar; baris yang
  // seri XP dengan saya mendapat peringkat sama, bukan target salip.
  let above: LeagueRow | null = null;
  for (let i = myIndex - 1; i >= 0; i -= 1) {
    if (all[i].xp > all[myIndex].xp) {
      above = all[i];
      break;
    }
  }
  return {
    ...base,
    rows,
    rank: myIndex >= 0 ? all[myIndex].rank : null,
    next: above ? { name: above.name, gap: Math.max(1, above.xp - all[myIndex].xp + 1) } : null,
  };
}
