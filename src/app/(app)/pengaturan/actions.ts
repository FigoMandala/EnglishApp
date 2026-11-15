"use server";

import { revalidatePath } from "next/cache";

import { createSession, deleteSessionsByUserId, updateDisplayName, updatePasswordHash } from "@/db/queries/auth";
import { validateDisplayName, validatePasswordChange } from "@/lib/account-validation";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/security";
import { requireUser, setSessionCookie } from "@/lib/session";

export type SettingsState = {
  status: "idle" | "ok" | "error";
  message?: string;
  fields?: { current?: string; next?: string; name?: string };
};

// Tebakan kata sandi lama lewat sesi curian dibatasi: 5 salah per 15 menit per akun.
const PASSWORD_FAIL_LIMIT = 5;
const PASSWORD_FAIL_WINDOW_MS = 15 * 60 * 1000;
const SESSION_MAX_AGE = 30 * 86_400;

export async function updateDisplayNameAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const result = validateDisplayName(String(formData.get("displayName") ?? ""));
  if (result.value === null) return { status: "error", fields: { name: result.error } };
  await updateDisplayName(user.id, result.value);
  revalidatePath("/pengaturan");
  revalidatePath("/", "layout");
  return { status: "ok", message: "Nama tampilan tersimpan." };
}

export async function changePasswordAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  const fields = validatePasswordChange(current, next);
  if (fields.current || fields.next) return { status: "error", fields };

  if (!(await verifyPassword(current, user.passwordHash))) {
    const limit = await checkRateLimit(`pwchange:${user.id}`, PASSWORD_FAIL_LIMIT, PASSWORD_FAIL_WINDOW_MS);
    if (!limit.ok) {
      const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60_000));
      return { status: "error", fields: { current: `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.` } };
    }
    await logAudit({ actorId: user.id, action: "password_change_failed" });
    return { status: "error", fields: { current: "Kata sandi saat ini salah." } };
  }

  await updatePasswordHash(user.id, await hashPassword(next));
  // Cabut sesi lain (perangkat lain / cookie curian), lalu buat sesi baru untuk perangkat ini.
  await deleteSessionsByUserId(user.id);
  await setSessionCookie(await createSession(user.id), SESSION_MAX_AGE);
  await logAudit({ actorId: user.id, action: "password_changed" });
  revalidatePath("/pengaturan");
  return { status: "ok", message: "Kata sandi diganti. Perangkat lain keluar otomatis." };
}
