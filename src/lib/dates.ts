import { shiftDate, streakDays, todayISO, nextReview } from "./srs";

export { shiftDate, streakDays, todayISO, nextReview };

export function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Ubah timestamp DB ("YYYY-MM-DD HH:MM:SS", UTC) menjadi Date; null kalau bentuknya bukan timestamp. */
function parseUtcTimestamp(value: string) {
  if (!value.includes("T") && !value.includes(" ")) return null;
  const raw = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Bagian tanggal (YYYY-MM-DD) dari tanggal polos atau timestamp, dalam WIB. */
function jakartaDatePart(value: string) {
  const parsed = parseUtcTimestamp(value);
  // Timestamp dari DB dikonversi ke WIB dulu supaya tanggal yang tampil
  // sesuai hari kalender pengguna.
  if (parsed) return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(parsed);
  return value.slice(0, 10);
}

export function formatDate(value: string) {
  const date = new Date(`${jakartaDatePart(value)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Timestamp UTC dari DB -> "05 Nov 2026 21.03" dalam WIB. */
export function formatDateTime(value: string) {
  const parsed = parseUtcTimestamp(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(parsed);
}

export function relativeDay(value: string | null | undefined) {
  if (!value) return "";
  const diff = daysBetween(todayISO(), jakartaDatePart(value));
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Besok";
  if (diff === -1) return "Kemarin";
  if (diff < 0) return `${Math.abs(diff)} hari lalu`;
  return `${diff} hari lagi`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
