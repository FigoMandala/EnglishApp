import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Daftar frekuensi disimpan di repo, satu kata per baris, urut paling sering. */
export const FREQUENCY_FILE = join(process.cwd(), "src", "db", "data", "frequency-10000.txt");

/** Kata yang tidak layak dijadikan bahan belajar (kasar, teknis web, singkatan). */
const BLOCKLIST = new Set([
  "porn", "porno", "nude", "naked", "sex", "sexy", "ass", "cum", "pussy", "rape",
  "incest", "penis", "vagina", "milf", "xxx", "fucking", "fuck", "shit", "bitch",
  "dick", "cock", "boob", "boobs", "anal", "lesbian", "gay", "casino", "poker",
  "html", "xml", "php", "rss", "dvd", "dvds", "cd", "pc", "usb", "url", "faq",
  "http", "www", "com", "net", "org", "ebay", "yahoo", "google", "msn", "cnet",
  "nokia", "sony", "dell", "mac", "microsoft", "windows", "linux", "java",
  "pm", "am", "gmt", "pst", "est", "tm", "pa", "ma", "md", "dc", "nc", "tx",
  "ca", "az", "fl", "il", "mi", "va", "us", "uk", "ny", "la", "ms", "mb", "kb",
  "gb", "ii", "iii", "iv", "oct", "nov", "dec", "jan", "feb", "mar", "apr",
  "jun", "jul", "aug", "sep", "mon", "tue", "wed", "thu", "fri", "sat", "sun",
  "aa", "ab", "ad", "ae", "af", "ag", "ah", "ai", "aj", "ak", "al", "an", "ao",
]);

/** Hanya terima kata Inggris yang wajar: huruf, panjang cukup, bukan singkatan. */
export function isLearnableWord(word: string) {
  const clean = word.trim().toLowerCase();
  if (clean.length < 3 || clean.length > 18) return false;
  if (!/^[a-z]+$/.test(clean)) return false;
  if (BLOCKLIST.has(clean)) return false;
  return true;
}

export type FrequencyEntry = { word: string; rank: number };

/**
 * Baca daftar frekuensi, buang kata tidak layak, ambil sampai `limit` kata.
 * Peringkat tetap mengikuti urutan asli file supaya artinya "frekuensi nyata".
 */
export function loadFrequencyList(limit: number, file = FREQUENCY_FILE): FrequencyEntry[] {
  const raw = readFileSync(file, "utf8");
  const lines = raw.split(/\r?\n/);
  const seen = new Set<string>();
  const result: FrequencyEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const word = lines[index].trim().toLowerCase();
    if (!word || !isLearnableWord(word) || seen.has(word)) continue;
    seen.add(word);
    result.push({ word, rank: index + 1 });
    if (result.length >= limit) break;
  }

  return result;
}

/** Kelompokkan peringkat frekuensi menjadi rentang 1.000 kata. */
export function frequencyBand(rank: number) {
  if (rank <= 1000) return "top-1000";
  if (rank <= 2000) return "top-2000";
  if (rank <= 3000) return "top-3000";
  if (rank <= 5000) return "top-5000";
  return "rest";
}

export const FREQUENCY_BAND_LABEL: Record<string, string> = {
  "top-1000": "1.000 kata tersering",
  "top-2000": "1001-2000 tersering",
  "top-3000": "2001-3000 tersering",
  "top-5000": "3001-5000 tersering",
  rest: "Di luar 5.000 teratas",
};