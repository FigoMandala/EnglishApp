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
import { CLOSED_MESSAGE, SITE_CLOSED } from "@/lib/site-lock";
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

// Hash buangan untuk memverifikasi username yang tidak ada dengan biaya scrypt
// yang sama, supaya latensi tidak membocorkan keberadaan akun.
const DUMMY_HASH =
  "scrypt2$65536$8$1$ZWB2U2ZGC5WhghDS30RqXg$Ngh9-OCyJqkpVAqbEh5lBbCU3TAj8AqfWsv1xxSXNctfuuB0GUGFLdq1G9Xor2qBLdtmi-vF9LFE9wwBxWeh7Q";

export type AuthState = { error?: string };

function isUniqueViolation(error: unknown) {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (SITE_CLOSED) return { error: "Pendaftaran belum dibuka. Aplikasi sedang dalam tahap pengembangan." };

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

  if (!username || !password) return { error: "Username dan kata sandi wajib diisi." };

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
  // Username yang tidak ada tetap diverifikasi ke hash dummy supaya waktu
  // responsnya sama — tanpa ini keberadaan akun bisa dihitung dari latensi
  // (audit keamanan P3).
  const verified = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !verified) {
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
    // Saat situs ditutup, sandi benar dan sandi salah dibalas sama persis —
    // tanpa ini pesan penutupan menjadi oracle untuk memverifikasi sandi
    // bocoran (audit keamanan P3).
    if (SITE_CLOSED) return { error: CLOSED_MESSAGE };
    return { error: "Username atau kata sandi salah." };
  }

  // Setelah password benar, supaya keberadaan akun tidak bocor ke orang asing.
  if (SITE_CLOSED && user.role !== "admin") return { error: CLOSED_MESSAGE };

  await purgeExpiredSessions();
  const sessionId = await createSession(user.id);
  await setSessionCookie(sessionId, SESSION_MAX_AGE);
  await logAudit({ actorId: user.id, action: "login_success", detail: username });
  redirect(homePath());
}
