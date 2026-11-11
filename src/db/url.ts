import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

/** URL libSQL dari env; path file relatif dijadikan absolut dan foldernya dibuat. */
export function resolveDbUrl(raw: string) {
  raw = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;

  const file = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  const absolute = isAbsolute(file) ? file : resolve(process.cwd(), file);
  mkdirSync(dirname(absolute), { recursive: true });
  return `file:${absolute}`;
}
