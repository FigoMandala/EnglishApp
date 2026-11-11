import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// promisify memilih overload 3-arg; paksa bentuk 4-arg dengan opsi biaya.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Biaya scrypt untuk hash baru: 4x rekomendasi Node bawaan (N=16384 → 65536),
 * mengikuti arah OWASP. Dibatasi N=2^16 (≈64 MB/op) supaya login tetap ringan
 * di lambda serverless 1 GB. Format lama `scrypt$salt$key` tetap diverifikasi
 * dengan parameter Node default, jadi hash yang sudah ada tidak rusak.
 */
const SCRYPT_PARAMS = { N: 2 ** 16, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH).toString("base64url");
  const key = (await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_PARAMS)) as Buffer;
  return `scrypt2$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts[0] === "scrypt2") {
    const [, n, r, p, salt, hash] = parts;
    if (!n || !r || !p || !salt || !hash) return false;
    const expected = Buffer.from(hash, "base64url");
    const actual = (await scryptAsync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT_PARAMS.maxmem,
    })) as Buffer;
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }

  // Format lama (parameter Node default).
  const [, salt, hash] = parts;
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
