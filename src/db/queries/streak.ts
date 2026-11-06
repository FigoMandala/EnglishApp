import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { xpEvents } from "@/db/schema";
import { getSetting, setSetting } from "@/db/queries/activity";
import { computeStreak, freezesAvailable, longestStreak } from "@/lib/streak";

export const STREAK_KEYS = { frozen: "streak_frozen", weekendEasy: "streak_weekend_easy" } as const;

/** Tanggal (YYYY-MM-DD) saat pengguna mendapat XP. */
export async function studiedDates(userId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ date: xpEvents.date })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), gt(xpEvents.amount, 0)));
  return rows.map((row) => row.date);
}

export async function getStreakState(userId: number, today: string) {
  const [studied, frozen, weekendEasy] = await Promise.all([
    studiedDates(userId),
    getSetting<string[]>(userId, STREAK_KEYS.frozen, []),
    getSetting<boolean>(userId, STREAK_KEYS.weekendEasy, false),
  ]);
  const options = { frozen, weekendEasy };
  return {
    studied,
    frozen,
    weekendEasy,
    streak: computeStreak(studied, today, options),
    longest: longestStreak(studied, today, options),
    freezes: freezesAvailable(studied.length, frozen.length),
    studiedToday: studied.includes(today),
  };
}

/** Pakai satu pelindung untuk hari ini. Mengembalikan pesan error atau null. */
export async function spendFreeze(userId: number, today: string): Promise<string | null> {
  // setting frozen ditulis utuh (read-modify-write), jadi dua tab yang memakai
  // pelindung bersamaan bisa saling menimpa. Verifikasi setelah menulis: kalau
  // tulisan kita tertimpa snapshot lama tab lain, baca ulang dan coba lagi
  // supaya tanggal yang hilang tertulis kembali.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await getStreakState(userId, today);
    if (state.studiedToday) return "Kamu sudah belajar hari ini, pelindung tidak perlu.";
    if (state.frozen.includes(today)) return "Hari ini sudah dilindungi.";
    if (state.freezes <= 0) return "Belum ada pelindung. Satu pelindung terisi tiap 7 hari belajar.";
    await setSetting(userId, STREAK_KEYS.frozen, [...new Set([...state.frozen, today])]);
    const verify = await getSetting<string[]>(userId, STREAK_KEYS.frozen, []);
    if (verify.includes(today)) return null;
  }
  return "Pelindung tidak bisa dipakai sekarang. Coba lagi sebentar.";
}

export const setWeekendEasy = (userId: number, on: boolean) => setSetting(userId, STREAK_KEYS.weekendEasy, on);
