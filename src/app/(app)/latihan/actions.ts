"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { xpEvents } from "@/db/schema";
import { logActivity } from "@/db/queries/activity";
import { addXp } from "@/db/queries/learning";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";

/** Batas total XP dari mode latihan per hari, supaya liga dan streak tidak bisa dipompa. */
const DAILY_DRILL_XP_CAP = 120;

export type DrillKind = "listening" | "speaking" | "pairs";

/** XP per poin skor dan batas per sesi. Klien tidak dipercaya: semua dibatasi di server. */
const RULES: Record<DrillKind, { perPoint: number; cap: number; maxTotal: number; log: "vocab" | "chat"; label: string }> = {
  listening: { perPoint: 5, cap: 40, maxTotal: 10, log: "vocab", label: "Dengar & jawab" },
  speaking: { perPoint: 0.2, cap: 20, maxTotal: 100, log: "chat", label: "Ucapkan" },
  pairs: { perPoint: 4, cap: 40, maxTotal: 12, log: "vocab", label: "Cocokkan pasangan" },
};

export type DrillResult = { status: "idle" | "error"; xp?: number; message?: string };

/**
 * Catat satu sesi mode latihan bebas dan beri XP.
 * `score` = jumlah benar (listening, pairs) atau skor 0–100 (speaking).
 */
export async function finishDrillAction(kind: DrillKind, score: number, total: number): Promise<DrillResult> {
  const user = await requireUser();
  const rule = RULES[kind];
  if (!rule || !Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || total > rule.maxTotal) {
    return { status: "error", message: "Data sesi tidak valid." };
  }
  const clamped = Math.max(0, Math.min(score, kind === "speaking" ? 100 : total));
  const today = todayISO();
  const [earned] = await db
    .select({ n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, user.id), eq(xpEvents.reason, "drill"), eq(xpEvents.date, today)));
  const room = Math.max(0, DAILY_DRILL_XP_CAP - Number(earned?.n ?? 0));
  const xp = Math.min(rule.cap, room, Math.round(clamped * rule.perPoint));

  if (xp > 0) await addXp(user.id, xp, "drill", today);
  await logActivity(
    user.id,
    rule.log,
    `${rule.label}: ${kind === "speaking" ? `skor ${clamped}` : `${clamped}/${total}`}`,
    today,
  );
  revalidatePath("/belajar");
  revalidatePath("/latihan");
  return { status: "idle", xp };
}
