"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AiError } from "@/lib/ai-client";
import { startSimulation } from "@/lib/api/eprt-simulation";
import { requireUser } from "@/lib/session";
import type { ToeflSection } from "@/lib/toefl";

export type SimulationState = { status: "idle" | "error"; message?: string };

function errorMessage(error: unknown) {
  return error instanceof AiError ? error.message : "Asisten AI sedang bermasalah.";
}

const SCOPES: ToeflSection[] = ["listening", "structure", "reading"];

/** Tanpa `section`: simulasi penuh. Dengan `section`: mini-test satu section. */
export async function startSimulationAction(section?: string): Promise<SimulationState> {
  const user = await requireUser();
  const scope = SCOPES.find((item) => item === section) ?? null;
  let id: number;
  try {
    id = await startSimulation(user.id, scope);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/toefl");
  redirect(`/toefl/simulasi?id=${id}`);
}


