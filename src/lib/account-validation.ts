import { validatePassword } from "./validation";

export const DISPLAY_NAME_MAX = 40;

/** Rapikan spasi ganda, lalu cek 1-40 karakter. Mengembalikan nama bersih atau pesan galat. */
export function validateDisplayName(
  raw: string,
): { value: string; error: null } | { value: null; error: string } {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { value: null, error: "Nama tampilan wajib diisi." };
  if ([...value].length > DISPLAY_NAME_MAX) {
    return { value: null, error: `Nama tampilan maksimal ${DISPLAY_NAME_MAX} karakter.` };
  }
  return { value, error: null };
}

export type PasswordChangeErrors = { current?: string; next?: string };

export function validatePasswordChange(current: string, next: string): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};
  if (!current) errors.current = "Isi kata sandi saat ini.";
  const nextError = validatePassword(next);
  if (nextError) errors.next = nextError.replace(/^Password/, "Kata sandi baru");
  else if (current && next === current) errors.next = "Kata sandi baru harus berbeda dari yang lama.";
  return errors;
}
