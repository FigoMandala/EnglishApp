import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { findSessionUser } from "@/db/queries/auth";
import type { User } from "@/db/schema";
import { SITE_CLOSED } from "@/lib/site-lock";

const COOKIE_NAME = "english_session";

function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Jangan bergantung pada APP_URL: kalau variabel itu lupa diisi, cookie sesi
    // bisa terkirim lewat HTTP dan dicuri. Di produksi selalu secure.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function setSessionCookie(sessionId: string, maxAgeSeconds: number) {
  const store = await cookies();
  store.set(COOKIE_NAME, sessionId, sessionCookieOptions(maxAgeSeconds));
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readSessionId() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const user = await findSessionUser(await readSessionId());
  // Situs ditutup: sesi non-admin yang masih hidup ikut tidak berlaku.
  return user && SITE_CLOSED && user.role !== "admin" ? null : user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Pengguna biasa (role "user") hanya boleh memakai EPrT; admin boleh semuanya. */
export function isAdmin(user: Pick<User, "role">) {
  return user.role === "admin";
}

export function homePath() {
  return "/eptr";
}

/** Untuk halaman dan aksi di luar EPrT. Non-admin diarahkan ke beranda (EPrT). */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect(homePath());
  return user;
}
