import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "./src/db/content-schema.ts",
  out: "./drizzle-content",
  dialect: "turso",
  dbCredentials: {
    url: process.env.CONTENT_DATABASE_URL ?? "file:./data/content.db",
    authToken: process.env.CONTENT_DATABASE_AUTH_TOKEN,
  },
});
