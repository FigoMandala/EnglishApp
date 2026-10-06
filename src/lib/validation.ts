const USERNAME_MIN = 3;
const USERNAME_MAX = 24;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function normalizeUsername(value: string) {
  return value.trim();
}

export function validateUsername(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (!username) return "Username wajib diisi.";
  if (username.length < USERNAME_MIN) return `Username minimal ${USERNAME_MIN} karakter.`;
  if (username.length > USERNAME_MAX) return `Username maksimal ${USERNAME_MAX} karakter.`;
  if (!USERNAME_PATTERN.test(username)) {
    return "Username hanya boleh huruf, angka, dan garis bawah.";
  }
  return null;
}

export function validatePassword(raw: string): string | null {
  if (!raw) return "Password wajib diisi.";
  if (raw.length < PASSWORD_MIN) return `Password minimal ${PASSWORD_MIN} karakter.`;
  if (raw.length > PASSWORD_MAX) return `Password maksimal ${PASSWORD_MAX} karakter.`;
  return null;
}
