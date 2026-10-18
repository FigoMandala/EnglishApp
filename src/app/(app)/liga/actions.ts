"use server";

import { revalidatePath } from "next/cache";

import { setLeagueOptIn } from "@/db/queries/league";
import { requireUser } from "@/lib/session";

export async function setLeagueOptInAction(on: boolean) {
  const user = await requireUser();
  await setLeagueOptIn(user.id, Boolean(on));
  revalidatePath("/liga");
  return { ok: true };
}
