import { sql } from "drizzle-orm";
import { blob, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import type { AudioLine, SkillKey } from "@/lib/toefl";

/**
 * Bank soal Listening. Progres pengguna (DB akun) hanya menyimpan `id` soal
 * sebagai angka biasa, tanpa foreign key: SQLite tidak bisa join lintas file.
 * Soal hanya ditambah, jangan dihapus atau di-reset ID-nya.
 */

/** Bahasa isi soal. Soal mewarisi bahasa dari talk-nya; tabel soal tidak perlu kolom sendiri. */
export type ContentLanguage = "en" | "ja";

/** Satu percakapan/monolog; dibagi oleh 1 soal (short) atau beberapa soal (long, lecture). */
export const listeningTalks = sqliteTable(
  "listening_talks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["listen-short", "listen-long", "listen-lecture"] }).notNull(),
    level: text("level", { enum: ["low", "mid", "high"] }).notNull(),
    language: text("language", { enum: ["en", "ja"] })
      .notNull()
      .default("en"),
    /** Skrip lengkap; audionya satu file utuh di `listening_audio`. */
    script: text("script", { mode: "json" }).$type<AudioLine[]>().notNull(),
    /** sha256(skrip ternormalisasi): cegah percakapan ganda saat generate berulang. */
    hash: text("hash").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("listening_talks_hash_idx").on(table.hash),
    index("listening_talks_pick_idx").on(table.language, table.kind, table.level),
  ],
);

export const listeningQuestions = sqliteTable(
  "listening_questions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    talkId: integer("talk_id")
      .notNull()
      .references(() => listeningTalks.id, { onDelete: "cascade" }),
    skill: text("skill").$type<SkillKey>().notNull(),
    question: text("question").notNull(),
    options: text("options", { mode: "json" }).$type<string[]>().notNull(),
    answer: integer("answer").notNull(),
    explainId: text("explain_id").notNull(),
    /** sha256(pertanyaan + pilihan terurut) per percakapan. */
    hash: text("hash").notNull(),
  },
  (table) => [
    uniqueIndex("listening_questions_hash_idx").on(table.hash),
    index("listening_questions_talk_idx").on(table.talkId),
  ],
);

/**
 * Satu mp3 utuh per percakapan (semua baris dialog sudah digabung), BLOB mentah (bukan base64, hemat ~25%).
 * Tabel terpisah supaya query soal tidak ikut menarik audio; diambil lewat primary key = 1 baris dibaca.
 */
export const listeningAudio = sqliteTable("listening_audio", {
  talkId: integer("talk_id")
    .primaryKey()
    .references(() => listeningTalks.id, { onDelete: "cascade" }),
  mp3: blob("mp3", { mode: "buffer" }).notNull(),
});
