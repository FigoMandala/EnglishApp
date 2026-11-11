"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  adminCounts,
  deleteBankItem,
  deleteUser,
  demoteAdminGuarded,
  findUserRole,
  getBankItem,
  listAllUnits,
  reopenModerationFlag,
  resetQuestionStats,
  resolveModerationFlag,
  setUnitItemOrder,
  setUnitOrder,
  setUnitPublished,
  setUserRole,
  updateBankItem,
} from "@/db/queries/admin";
import type { LevelBand } from "@/db/queries/question-bank";
import { logAiUsage } from "@/db/queries/ai-usage";
import { createVocabulary, listVocabulary, updateVocabulary } from "@/db/queries/vocabulary";
import { editBankItem, moveInOrder, parseWordInput, roleChangeError, type QuestionEdit } from "@/lib/admin";
import { fingerprint, questionText } from "@/lib/question-variety";
import { parseQuestions } from "@/lib/toefl";
import { budgetError, setDailyBudgetUsd } from "@/lib/ai-budget";
import { chatJsonRaw } from "@/lib/ai-client";
import { EMPTY_USAGE } from "@/lib/ai-pricing";
import { aiConfigured, getAiConfig, reasoningExtra, setAiConfig, type ReasoningEffort } from "@/lib/ai-config";
import { dictionaryPhonetic } from "@/lib/dictionary";
import { parseGeneratedWords, toVocabRow, VOCAB_LEVELS, type VocabLevel } from "@/lib/vocabulary-generator";
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
  // Jepit sebelum alokasi: count raksasa mencoba mengalokasikan miliaran
  // elemen sebelum validasi struktural jalan (self-DoS admin, audit P3).
  const questions: QuestionEdit[] = Array.from({ length: Math.min(50, Math.max(0, count)) }, (_, i) => {
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
  const track = "eptr"; // TOEFL disembunyikan sementara
  const status = String(formData.get("status") ?? "all");
  if (!Number.isInteger(id) || id <= 0) back("/admin/soal", { track, status, galat: "Soal tidak dikenal." });

  // Statistik kalibrasi soal yang ditarik ikut direset — kalau tidak, soal
  // identik yang dibuat ulang nanti mewarisi vonis lama (audit keamanan P3).
  const row = await getBankItem(id);
  if (row && row.track === track) {
    const prints = fingerprintPrints(row.item);
    await resetQuestionStats(track, prints);
    await deleteBankItem(id, track);
    await logAudit({ actorId: admin.id, action: "question.retire", detail: `${track} #${id} (${row.kind}), ${prints.length} fingerprint direset` });
    revalidatePath("/admin/soal");
    back("/admin/soal", { track, status, pesan: `Soal #${id} ditarik dari bank.` });
  }
  revalidatePath("/admin/soal");
  back("/admin/soal", { track, status, pesan: "Soal sudah tidak ada." });
}

/** Fingerprint semua soal dalam satu item bank (untuk reset statistik). */
function fingerprintPrints(item: string): string[] {
  try {
    const stored = JSON.parse(item) as { questions?: unknown };
    return parseQuestions(JSON.stringify(stored.questions ?? [])).map((q) => fingerprint(questionText(q)));
  } catch {
    return [];
  }
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

export async function reopenFlagAction(formData: FormData) {
  const admin = await guard();
  const id = Number(formData.get("id"));
  const row = await reopenModerationFlag(id);
  if (row) {
    await logAudit({ actorId: admin.id, action: "moderation.reopen", detail: `#${id} ${row.feature}/${row.reason} → dibuka ulang` });
  }
  revalidatePath("/admin/moderasi");
  revalidatePath("/admin");
  back("/admin/moderasi", {
    pesan: row ? `Flag #${id} dikembalikan ke antrean tinjauan.` : "Flag belum ditinjau, tidak ada yang perlu dibuka.",
  });
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

  // Demote admin lewat jalur atomik: dua admin saling menurunkan secara
  // paralel tidak boleh menyisakan nol admin (audit keamanan P3).
  if (nextRole === "user" && target.role === "admin") {
    const demoted = await demoteAdminGuarded(targetId);
    if (!demoted) back("/admin/pengguna", { id: String(targetId), galat: "Harus ada minimal satu admin." });
  } else {
    await setUserRole(targetId, nextRole);
  }
  await logAudit({ actorId: admin.id, action: "user.role", detail: `@${target.username}: ${target.role} → ${nextRole}` });
  revalidatePath("/admin/pengguna");
  back("/admin/pengguna", { id: String(targetId), pesan: `Peran @${target.username} sekarang ${nextRole === "admin" ? "Admin" : "Pengguna"}.` });
}

/** Penuhi permintaan hapus data (UU PDP): hapus akun + seluruh datanya (cascade). */
export async function deleteUserDataAction(formData: FormData) {
  const admin = await guard();
  const targetId = Number(formData.get("userId"));
  const target = await findUserRole(targetId);
  if (!target) back("/admin/pengguna", { galat: "Pengguna tidak ditemukan." });

  // Penghapusan permanen butuh centang konfirmasi eksplisit.
  if (formData.get("confirm") !== "yes") {
    back("/admin/pengguna", { galat: "Centang konfirmasi dulu untuk menghapus akun & data." });
  }
  if (targetId === admin.id) {
    back("/admin/pengguna", { galat: "Tidak bisa menghapus akun sendiri." });
  }
  if (target.role === "admin") {
    back("/admin/pengguna", { galat: "Turunkan peran admin menjadi pengguna dulu sebelum menghapus." });
  }

  // Baris data_requests ikut terhapus otomatis (FK cascade); UI halaman
  // sudah menampilkan "akun sudah dihapus" untuk permintaan tanpa username.
  await deleteUser(targetId);
  await logAudit({ actorId: admin.id, action: "user.delete", detail: `@${target.username} beserta seluruh datanya dihapus` });
  revalidatePath("/admin/pengguna");
  back("/admin/pengguna", { pesan: `Akun @${target.username} dan seluruh datanya dihapus.` });
}

/* ═══ Generate konten (AI + kamus terbuka) ═══ */

const GENERATE = "/admin/generate";

export async function saveAiConfigAction(formData: FormData) {
  const admin = await guard();
  // Kolom kosong = pertahankan nilai lama (key tidak pernah ditampilkan ulang).
  try {
    await setAiConfig({
      baseUrl: String(formData.get("baseUrl") ?? ""),
      model: String(formData.get("model") ?? ""),
      verifyModel: String(formData.get("verifyModel") ?? ""),
      reasoningEffort: String(formData.get("reasoningEffort") ?? "") as ReasoningEffort,
      apiKey: String(formData.get("apiKey") ?? ""),
    });
  } catch (error) {
    // Validasi baseUrl (https, bukan host internal) menolak nilainya.
    back(GENERATE, { galat: error instanceof Error ? error.message : "Pengaturan AI tidak valid." });
  }
  await logAudit({ actorId: admin.id, action: "ai.config", detail: "Pengaturan AI diperbarui" });
  back(GENERATE, { pesan: "Pengaturan AI tersimpan." });
}

export async function generateWordsAction(formData: FormData) {
  const admin = await guard();
  const config = await getAiConfig();
  if (!aiConfigured(config)) back(GENERATE, { galat: "Isi key AI dulu di bagian Pengaturan AI." });

  const typed = String(formData.get("words") ?? "").split(/[\n,;]+/).map((w) => w.trim()).filter(Boolean).slice(0, 30);
  const topic = String(formData.get("topic") ?? "").trim().slice(0, 60) || "umum";
  const levelRaw = String(formData.get("level"));
  const level: VocabLevel = (VOCAB_LEVELS as readonly string[]).includes(levelRaw) ? (levelRaw as VocabLevel) : "intermediate";
  const count = Math.min(30, Math.max(1, Number(formData.get("count")) || 10));

  const ask = typed.length
    ? `Lengkapi data kamus untuk kata-kata ini: ${typed.join(", ")}.`
    : `Pilih ${count} kata baru yang berguna untuk EPrT/TOEFL ITP, topik "${topic}", level ${level}.`;
  let raw: string;
  let result: Awaited<ReturnType<typeof chatJsonRaw>> | null = null;
  const startedAt = Date.now();
  try {
    result = await chatJsonRaw(config, [
      {
        role: "system",
        content:
          'Kamu penyusun kamus Inggris untuk pelajar Indonesia. Balas HANYA JSON {"words":[{"word","meaning" (arti Indonesia singkat),"phonetic" (IPA),"partOfSpeech","exampleEn","exampleId" (terjemahan Indonesia contoh),"level" (basic|intermediate|advanced),"topic"}]}.',
      },
      { role: "user", content: ask },
    ], undefined, reasoningExtra(config));
    raw = result.content;
  } catch (error) {
    // Panggilan gagal tetap tercatat supaya dashboard biaya tidak silau.
    await logAiUsage({
      userId: admin.id,
      feature: "content",
      model: config.model,
      usage: EMPTY_USAGE,
      latencyMs: Date.now() - startedAt,
      ok: false,
    }).catch(() => undefined);
    back(GENERATE, { galat: error instanceof Error ? error.message : "Gagal menghubungi AI." });
  }
  await logAiUsage({
    userId: admin.id,
    feature: "content",
    model: config.model,
    usage: result.usage,
    latencyMs: result.latencyMs,
    ok: true,
  }).catch(() => undefined);

  const existing = new Set((await listVocabulary()).map((row) => row.wordLower));
  const words = parseGeneratedWords(raw, { level, topic }, existing);
  // Fonetik dari kamus sungguhan lebih tepercaya daripada tebakan model.
  const phonetics = await Promise.all(words.map((item) => dictionaryPhonetic(item.word)));
  let added = 0;
  for (const [i, item] of words.entries()) {
    try {
      await createVocabulary(toVocabRow({ ...item, phonetic: phonetics[i] ?? item.phonetic }));
      added += 1;
    } catch {
      // word_lower unik: kata yang sama dilewati.
    }
  }

  await logAudit({ actorId: admin.id, action: "vocabulary.generate", detail: `${added} kata (${typed.length ? "daftar admin" : topic})` });
  revalidatePath("/admin/kosakata");
  back(GENERATE, added ? { pesan: `${added} kata ditambahkan ke kamus.` } : { galat: "Tidak ada kata baru (semua sudah ada atau respons AI tidak terbaca)." });
}
