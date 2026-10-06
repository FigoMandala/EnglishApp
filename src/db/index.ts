import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import * as schema from "./schema";

function resolveUrl() {
  const raw = (process.env.DATABASE_URL ?? "file:./data/app.db").trim();

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;

  const file = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  const absolute = isAbsolute(file) ? file : resolve(process.cwd(), file);
  mkdirSync(dirname(absolute), { recursive: true });
  return `file:${absolute}`;
}

export const db = drizzle(
  createClient({
    url: resolveUrl(),
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  }),
  { schema },
);
