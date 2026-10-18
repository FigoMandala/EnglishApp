import { shiftDate } from "@/lib/srs";
import { levelFromXp } from "@/lib/xp";

/** Liga ditentukan dari level: tingkat naik saat levelmu naik. */
export const LEAGUE_TIERS = [
  { name: "Perunggu", minLevel: 1, fill: "#e0a84e", stroke: "#7a4b08", star: "#fff3d6" },
  { name: "Perak", minLevel: 5, fill: "#d6d9de", stroke: "#6b7280", star: "#ffffff" },
  { name: "Emas", minLevel: 10, fill: "#f2c878", stroke: "#a86a12", star: "#fff8e6" },
  { name: "Zamrud", minLevel: 15, fill: "#79c79a", stroke: "#145536", star: "#eaf5ee" },
  { name: "Berlian", minLevel: 20, fill: "#9ec0f5", stroke: "#224fa8", star: "#eef3fd" },
] as const;

export function tierIndexForXp(totalXp: number) {
  const { level } = levelFromXp(totalXp);
  let index = 0;
  LEAGUE_TIERS.forEach((tier, i) => {
    if (level >= tier.minLevel) index = i;
  });
  return index;
}

/** Senin sampai Minggu untuk minggu yang memuat `today`. */
export function weekBounds(today: string) {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const start = shiftDate(today, -((dow + 6) % 7));
  return { start, end: shiftDate(start, 6), prevStart: shiftDate(start, -7), prevEnd: shiftDate(start, -1) };
}

export type LeagueRow = { userId: number; name: string; xp: number; isMe: boolean };

/** Urutkan peringkat: XP minggu ini turun, lalu nama. */
export function rankRows(rows: LeagueRow[]) {
  return [...rows].sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
}
