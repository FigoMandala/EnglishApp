"use server";

import { redirect } from "next/navigation";

import { deleteSession } from "@/db/queries/auth";
import { clearSessionCookie, readSessionId } from "@/lib/session";

export async function logout() {
  const sessionId = await readSessionId();
  if (sessionId) await deleteSession(sessionId);
  await clearSessionCookie();
  redirect("/login");
}
