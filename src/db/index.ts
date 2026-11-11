import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";
import { resolveDbUrl } from "./url";

export const db = drizzle(
  createClient({
    url: resolveDbUrl(process.env.DATABASE_URL ?? "file:./data/app.db"),
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  }),
  { schema },
);
