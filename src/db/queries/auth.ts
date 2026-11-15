import { randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";

import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

const SESSION_TTL_DAYS = 30;

export function sessionExpiry(from: Date = new Date()) {
  return new Date(from.getTime() + SESSION_TTL_DAYS * 86_400_000);
}

export function stamp(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function findUserByUsername(username: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.usernameLower, username.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function createUser(values: {
  username: string;
  passwordHash: string;
  displayName?: string | null;
}) {
  const [row] = await db
    .insert(users)
    .values({
      username: values.username.trim(),
      usernameLower: values.username.trim().toLowerCase(),
      passwordHash: values.passwordHash,
      displayName: values.displayName?.trim() || null,
    })
    .returning();
  return row;
}

export async function createSession(userId: number) {
  const id = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({ id, userId, expiresAt: stamp(sessionExpiry()) });
  return id;
}

export async function findSessionUser(sessionId: string | undefined): Promise<User | null> {
  if (!sessionId) return null;
  const now = stamp(new Date());
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);
  return row?.user ?? null;
}

export async function deleteSession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Cabut semua sesi milik satu pengguna (logout paksa semua perangkat).
 * Wajib dipanggil setelah rotasi password: tanpa ini cookie curian tetap
 * hidup sampai 30 hari meski sandinya sudah diganti (audit keamanan P2).
 */
export async function deleteSessionsByUserId(userId: number) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, stamp(new Date())));
}

export async function updateDisplayName(userId: number, displayName: string) {
  await db.update(users).set({ displayName }).where(eq(users.id, userId));
}

export async function updatePasswordHash(userId: number, passwordHash: string) {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
