"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  adminCounts,
  deleteBankItem,
  findUserRole,
  getBankItem,
  listAllUnits,
  resetQuestionStats,
  resolveModerationFlag,
  setUnitItemOrder,
  setUnitOrder,
  setUnitPublished,
  setUserRole,
  updateBankItem,
} from "@/db/queries/admin";
import type { LevelBand } from "@/db/queries/question-bank";
import { createVocabulary, updateVocabulary } from "@/db/queries/vocabulary";
import { editBankItem, moveInOrder, parseWordInput, roleChangeError, type QuestionEdit } from "@/lib/admin";
import { budgetError, setDailyBudgetUsd } from "@/lib/ai-budget";
import { assertSameOrigin, logAudit } from "@/lib/security";
import { requireAdmin } from "@/lib/session";

/** Semua aksi admin: wajib admin + origin sama, lalu dicatat di log audit. */
async function guard() {
  const admin = await requireAdmin();
  await assertSameOrigin();
  return admin;
}

function back(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

/** Isian form dikembalikan saat validasi gagal, supaya admin tidak mengetik ulang. */
export type FormState = { error?: string; values?: Record<string, string>; nonce?: number };

function echo(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

function fail(formData: FormData, error: string): FormState {
  return { error, values: echo(formData), nonce: Date.now() };
}

/* ═══ Kosakata ═══ */

export async function saveWordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await guard();
  const id = Number(formData.get("id")) || 0;
  const tab = String(formData.get("tab") ?? "all");
  const parsed = parseWordInput((key) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : null;
  });
  if ("error" in parsed) return fail(formData, parsed.error);

  let savedId = id;
  try {
    if (id) await updateVocabulary(id, parsed.values);
    else savedId = (await createVocabulary(parsed.values)).id;
  } catch (error) {
    // Indeks unik word_lower: kata yang sama sudah ada.
    return fail(formData, /unique/i.test(String(error)) ? "Kata ini sudah ada di kamus." : "Gagal menyimpan kata.");
  }

  await logAudit({
    actorId: admin.id,
    action: id ? "vocabulary.update" : "vocabulary.create",
    detail: `#${savedId} ${parsed.values.word}`,
  });
  revalidatePath("/admin/kosakata");
  back("/admin/kosakata", { tab, id: String(savedId), pesan: "Tersimpan." });
}

/* ═══ Bank soal ═══ */

const BANDS: LevelBand[] = ["low", "mid", "high"];

export async function saveBankItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await guard();
  const id = Number(formData.get("id"));
  const row = await getBankItem(id);
  if (!row) return fail(formData, "Soal tidak ditemukan. Mungkin sudah ditarik.");

  const levelBand = String(formData.get("levelBand")) as LevelBand;
  if (!BANDS.includes(levelBand)) return fail(formData, "Level tidak dikenal.");

  const count = Number(formData.get("count")) || 0;
  const questions: QuestionEdit[] = Array.from({ length: count }, (_, i) => {
    const optionCount = Number(formData.get(`optcount-${i}`)) || 0;
    return {
      q: String(formData.get(`q-${i}`) ?? ""),
      options: Array.from({ length: optionCount }, (_, j) => String(formData.get(`opt-${i}-${j}`) ?? "")),
      answer: Number(formData.get(`answer-${i}`) ?? -1),
      explain: String(formData.get(`explain-${i}`) ?? ""),
    };
  });
  const passage = formData.has("passage") ? String(formData.get("passage")) : null;

  const result = editBankItem(row.item, { passage, questions });
  if ("error" in result) return fail(formData, result.error);

  await updateBankItem(id, { item: result.item, levelBand });
  await resetQuestionStats(row.track, result.resetPrints);
  await logAudit({
    actorId: admin.id,
    action: "question.update",
    detail: `${row.track} #${id} · ${result.resetPrints.length} soal direset statistiknya`,
  });
  revalidatePath("/admin/soal");
  back(`/admin/soal/${id}`, {
    pesan: result.resetPrints.length
      ? `Tersimpan. Statistik ${result.resetPrints.length} soal direset karena isi/kuncinya berubah.`
      : "Tersimpan.",
  });
}

export async function retireBankItemAction(formData: FormData) {
  const admin = await guard();
  const id = Number(formData.get("id"));
  const track = formData.get("track") === "toefl" ? "toefl" : "eptr";
  const status = String(formData.get("status") ?? "all");
  if (!Number.isInteger(id) || id <= 0) back("/admin/soal", { track, status, galat: "Soal tidak dikenal." });

  const removed = await deleteBankItem(id);
  if (removed) {
    await logAudit({ actorId: admin.id, action: "question.retire", detail: `${removed.track} #${removed.id} (${removed.kind})` });
  }
  revalidatePath("/admin/soal");
  back("/admin/soal", { track, status, pesan: removed ? `Soal #${id} ditarik dari bank.` : "Soal sudah tidak ada." });
}

/* ═══ Moderasi & AI ═══ */

export async function resolveFlagAction(formData: FormData) {
  const admin = await guard();
  const id = Number(formData.get("id"));
  const resolution = formData.get("resolution") === "actioned" ? "actioned" : "safe";
  const row = await resolveModerationFlag(id, resolution);
  if (row) {
    await logAudit({ actorId: admin.id, action: "moderation.resolve", detail: `#${id} ${row.feature}/${row.reason} → ${resolution}` });
  }
  revalidatePath("/admin/moderasi");
  revalidatePath("/admin");
  back("/admin/moderasi", { pesan: row ? `Flag #${id} ditandai ${resolution === "safe" ? "aman" : "ditindak"}.` : "Flag sudah ditinjau sebelumnya." });
}

export async function setBudgetAction(formData: FormData) {
  const admin = await guard();
  const value = Number(String(formData.get("budget") ?? "").replace(",", "."));
  const error = budgetError(value);
  if (error) back("/admin/moderasi", { galat: error });

  await setDailyBudgetUsd(value);
  await logAudit({ actorId: admin.id, action: "ai.budget", detail: `Batas harian → $${value}` });
  revalidatePath("/admin/moderasi");
  revalidatePath("/admin");
  back("/admin/moderasi", { pesan: `Batas biaya AI harian sekarang $${value}.` });
}

/* ═══ Materi & jalur ═══ */

function direction(formData: FormData): -1 | 1 {
  return formData.get("dir") === "up" ? -1 : 1;
}

export async function moveUnitAction(formData: FormData) {
  const admin = await guard();
  const id = Number(formData.get("unitId"));
  const units = await listAllUnits();
  const order = moveInOrder(units.map((unit) => unit.id), id, direction(formData));
  await setUnitOrder(order);
  await logAudit({ actorId: admin.id, action: "unit.reorder", detail: `Unit #${id} ${direction(formData) < 0 ? "naik" : "turun"}` });
  revalidatePath("/admin/materi");
  revalidatePath("/belajar");
  back("/admin/materi", { unit: String(id) });
}

export async function moveUnitItemAction(formData: FormData) {
  const admin = await guard();
  const unitId = Number(formData.get("unitId"));
  const itemId = Number(formData.get("itemId"));
  const unit = (await listAllUnits()).find((u) => u.id === unitId);
  if (!unit) back("/admin/materi", { galat: "Unit tidak ditemukan." });
  const order = moveInOrder(unit.items.map((item) => item.id), itemId, direction(formData));
  await setUnitItemOrder(unitId, order);
  await logAudit({ actorId: admin.id, action: "unit.items_reorder", detail: `Unit #${unitId}, item #${itemId}` });
  revalidatePath("/admin/materi");
  revalidatePath("/belajar");
  back("/admin/materi", { unit: String(unitId) });
}

export async function toggleUnitAction(formData: FormData) {
  const admin = await guard();
  const id = Number(formData.get("unitId"));
  const publish = formData.get("publish") === "1";
  const row = await setUnitPublished(id, publish);
  if (row) {
    await logAudit({ actorId: admin.id, action: publish ? "unit.publish" : "unit.unpublish", detail: `#${id} ${row.title}` });
  }
  revalidatePath("/admin/materi");
  revalidatePath("/belajar");
  back("/admin/materi", {
    unit: String(id),
    pesan: row ? `“${row.title}” ${publish ? "diterbitkan" : "disembunyikan dari pelajar"}.` : "Unit tidak ditemukan.",
  });
}

/* ═══ Pengguna ═══ */

export async function setRoleAction(formData: FormData) {
  const admin = await guard();
  const targetId = Number(formData.get("userId"));
  const nextRole = formData.get("role") === "admin" ? "admin" : "user";
  const target = await findUserRole(targetId);
  if (!target) back("/admin/pengguna", { galat: "Pengguna tidak ditemukan." });

  // Menaikkan ke admin butuh centang konfirmasi eksplisit.
  if (nextRole === "admin" && formData.get("confirm") !== "yes") {
    back("/admin/pengguna", { id: String(targetId), galat: "Centang konfirmasi dulu untuk memberi akses admin." });
  }

  const { admins } = await adminCounts();
  const error = roleChangeError({
    actorId: admin.id,
    targetId,
    currentRole: target.role,
    nextRole,
    adminCount: admins,
  });
  if (error) back("/admin/pengguna", { id: String(targetId), galat: error });

  await setUserRole(targetId, nextRole);
  await logAudit({ actorId: admin.id, action: "user.role", detail: `@${target.username}: ${target.role} → ${nextRole}` });
  revalidatePath("/admin/pengguna");
  back("/admin/pengguna", { id: String(targetId), pesan: `Peran @${target.username} sekarang ${nextRole === "admin" ? "Admin" : "Pengguna"}.` });
}
