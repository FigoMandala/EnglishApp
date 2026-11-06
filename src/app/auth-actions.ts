"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSession,
  createUser,
  findUserByUsername,
  purgeExpiredSessions,
} from "@/db/queries/auth";
import { applyOnboarding } from "@/db/queries/onboarding";
import type { User } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/security";
import { homePath, setSessionCookie } from "@/lib/session";
import { normalizeUsername, validatePassword, validateUsername } from "@/lib/validation";

const SESSION_MAX_AGE = 30 * 86_400;
// 10 percobaan login per 15 menit per username.
const LOGIN_LIMIT = 10;
// 30 percobaan login per 15 menit per IP (cegah credential stuffing ke banyak username).
const LOGIN_IP_LIMIT = 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
// 5 pendaftaran per jam per IP.
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

export type AuthState = { error?: string };

function isUniqueViolation(error: unknown) {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");

  const usernameError = validateUsername(username);
  if (usernameError) return { error: usernameError };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const ip = clientIp(await headers());
  const limit = await checkRateLimit(`register:${ip}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!limit.ok) {
    return { error: "Terlalu banyak pendaftaran. Coba lagi nanti." };
  }

  if (await findUserByUsername(username)) {
    return { error: "Username sudah dipakai. Pilih yang lain." };
  }

  let user: User;
  try {
    user = await createUser({
      username,
      passwordHash: await hashPassword(password),
    });
  } catch (error) {
    // Dua pendaftaran bersamaan bisa lolos pengecekan di atas; indeks unik
    // usernameLower yang menangkapnya.
    if (isUniqueViolation(error)) {
      return { error: "Username sudah dipakai. Pilih yang lain." };
    }
    throw error;
  }

  await logAudit({ actorId: user.id, action: "register", detail: username });
  // Hasil onboarding (opsional) dari /mulai: nama panggilan, tujuan, level, target harian.
  await applyOnboarding(user.id, formData.get("onboarding"), formData.get("displayName")).catch((error) => {
    console.error("[onboarding] gagal menyimpan hasil, akun tetap dibuat", error);
  });
  const sessionId = await createSession(user.id);
  await setSessionCookie(sessionId, SESSION_MAX_AGE);
  redirect(homePath());
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { error: "Username dan password wajib diisi." };

  const ip = clientIp(await headers());
  // Limit per-IP dihitung untuk semua percobaan (menahan credential stuffing
  // ke banyak username sebelum menyentuh DB).
  const perIp = await checkRateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
  if (!perIp.ok) {
    await logAudit({ action: "login_rate_limited", detail: username });
    const minutes = Math.max(1, Math.ceil(perIp.retryAfterMs / 60_000));
    return { error: `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.` };
  }

  const user = await findUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    // Hanya percobaan GAGAL yang menghitung limit per-username: username
    // terlihat di papan liga, jadi limit atas semua percobaan memudahkan
    // lockout tertarget terhadap pengguna sah.
    const perUser = await checkRateLimit(
      `login:user:${username.toLowerCase()}`,
      LOGIN_LIMIT,
      LOGIN_WINDOW_MS,
    );
    if (!perUser.ok) {
      await logAudit({ action: "login_rate_limited", detail: username });
      const minutes = Math.max(1, Math.ceil(perUser.retryAfterMs / 60_000));
      return { error: `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.` };
    }
    await logAudit({ action: "login_failed", detail: username });
    return { error: "Username atau password salah." };
  }

  await purgeExpiredSessions();
  const sessionId = await createSession(user.id);
  await setSessionCookie(sessionId, SESSION_MAX_AGE);
  await logAudit({ actorId: user.id, action: "login_success", detail: username });
  redirect(homePath());
}
