"use server";

import { revalidatePath } from "next/cache";

import { setWeekendEasy, spendFreeze } from "@/db/queries/streak";
import { requireUser } from "@/lib/session";
import { todayISO } from "@/lib/srs";

export type StreakActionResult = { ok: boolean; message?: string };

function refresh() {
  revalidatePath("/streak");
  revalidatePath("/belajar");
  revalidatePath("/progres");
}

export async function spendFreezeAction(): Promise<StreakActionResult> {
  const user = await requireUser();
  const error = await spendFreeze(user.id, todayISO());
  if (error) return { ok: false, message: error };
  refresh();
  return { ok: true };
}

export async function setWeekendEasyAction(on: boolean): Promise<StreakActionResult> {
  const user = await requireUser();
  await setWeekendEasy(user.id, Boolean(on));
  refresh();
  return { ok: true };
}
