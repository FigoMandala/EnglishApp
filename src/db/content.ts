import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./content-schema";
import { resolveDbUrl } from "./url";

/** DB konten (bank soal + audio), terpisah dari DB akun di `./index.ts`. Tidak ada relasi lintas DB. */
export const contentDb = drizzle(
  createClient({
    url: resolveDbUrl(process.env.CONTENT_DATABASE_URL ?? "file:./data/content.db"),
    authToken: process.env.CONTENT_DATABASE_AUTH_TOKEN?.trim() || undefined,
  }),
  { schema },
);
