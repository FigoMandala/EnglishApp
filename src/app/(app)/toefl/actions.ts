"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { setSetting, SETTING_KEYS, type ToeflTarget } from "@/db/queries/activity";
import type { Track } from "@/db/queries/toefl";
import { AiError } from "@/lib/ai-client";
import { answerQuestion, finishSession, startBlock, type BlockKind } from "@/lib/api/toefl-turn";
import { requireUser } from "@/lib/session";
import { isSkill } from "@/lib/toefl";

export type ToeflState = { status: "idle" | "error"; message?: string };

const BASE_PATH: Record<Track, string> = { toefl: "/eptr", eptr: "/eptr" };
const TARGET_KEY: Record<Track, string> = {
  toefl: SETTING_KEYS.toeflTarget,
  eptr: SETTING_KEYS.eptrTarget,
};

// TOEFL disembunyikan sementara: semua aksi dipaksa ke EPrT. Kembalikan pembacaan form + cek admin untuk mengaktifkan lagi.
const asTrack = (): Track => "eptr";

function errorMessage(error: unknown) {
  return error instanceof AiError ? error.message : "Asisten AI sedang bermasalah.";
}

export async function startToeflBlock(_prev: ToeflState, formData: FormData): Promise<ToeflState> {
  const user = await requireUser();
  const track = asTrack();
  const kind =String(formData.get("kind") ?? "");
  const VALID_KINDS: BlockKind[] = [
    "drill",
    "written",
    "reading",
    "listening",
    "listening-15",
    "listen-long",
    "listen-lecture",
    "review",
  ];
  if (!VALID_KINDS.includes(kind as BlockKind)) {
    return { status: "error", message: "Blok latihan tidak valid." };
  }

  const skill = formData.get("skill");
  let id: number;
  try {
    id = await startBlock(user.id, kind as BlockKind, track, isSkill(skill) ? skill : undefined);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(BASE_PATH[track]);
  redirect(`${BASE_PATH[track]}?s=${id}`);
}

export async function answerToefl(
  sessionId: number,
  index: number,
  choice: number,
): Promise<ToeflState> {
  const user = await requireUser();
  if (![sessionId, index, choice].every(Number.isInteger)) {
    return { status: "error", message: "Jawaban tidak valid." };
  }
  try {
    const complete = await answerQuestion(user.id, sessionId, index, choice);
    if (complete) {
      revalidatePath("/eptr");
    }
    return { status: "idle" };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function finishToefl(sessionId: number): Promise<ToeflState> {
  const user = await requireUser();
  if (!Number.isInteger(sessionId)) return { status: "error", message: "Sesi tidak valid." };
  try {
    await finishSession(user.id, sessionId);
    revalidatePath("/eptr");
    return { status: "idle" };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function saveToeflTarget(_prev: ToeflState, formData: FormData): Promise<ToeflState> {
  const user = await requireUser();
  const track = asTrack();
  const score = Number(formData.get("score"));
  const testDate = String(formData.get("testDate") ?? "").trim();

  if (!Number.isInteger(score) || score < 310 || score > 677) {
    return { status: "error", message: "Skor target harus angka 310 sampai 677." };
  }
  if (testDate && !/^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
    return { status: "error", message: "Tanggal tes tidak valid." };
  }

  const target: ToeflTarget = { score, testDate: testDate || null };
  await setSetting(user.id, TARGET_KEY[track], target);
  revalidatePath(BASE_PATH[track]);
  return { status: "idle" };
}
