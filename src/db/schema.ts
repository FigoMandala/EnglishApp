import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`);

export function sqliteNow() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

const updatedAt = () =>
  text("updated_at").notNull().$defaultFn(sqliteNow).$onUpdate(sqliteNow);

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    usernameLower: text("username_lower").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name"),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("users_username_lower_idx").on(table.usernameLower)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export type User = typeof users.$inferSelect;

export const vocabulary = sqliteTable(
  "vocabulary",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    word: text("word").notNull(),
    wordLower: text("word_lower").notNull(),
    meaning: text("meaning").notNull(),
    phonetic: text("phonetic"),
    partOfSpeech: text("part_of_speech"),
    exampleEn: text("example_en"),
    exampleId: text("example_id"),
    level: text("level", { enum: ["basic", "intermediate", "advanced"] })
      .notNull()
      .default("intermediate"),
    // Padanan CEFR (A1..C2) untuk peta kemampuan.
    cefr: text("cefr", { enum: ["A1", "A2", "B1", "B2", "C1", "C2"] }),
    topic: text("topic"),
    // Peringkat frekuensi pemakaian (1 = paling sering). Null kalau belum diketahui.
    frequencyRank: integer("frequency_rank"),
    // "Jembatan keledai" Lori: trik singkat biar kata gampang diingat. Diisi admin.
    mnemonic: text("mnemonic"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("vocabulary_word_lower_idx").on(table.wordLower),
    index("vocabulary_level_idx").on(table.level),
    index("vocabulary_frequency_idx").on(table.frequencyRank),
  ],
);

export const vocabularyProgress = sqliteTable(
  "vocabulary_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vocabularyId: integer("vocabulary_id")
      .notNull()
      .references(() => vocabulary.id, { onDelete: "cascade" }),
    box: integer("box").notNull().default(0),
    dueAt: text("due_at").notNull(),
    reviewCount: integer("review_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    // ── FSRS-lite: interval adaptif + faktor kemudahan ──
    // easeFactor: pengali interval (default 2.5, turun saat lupa, naik saat lancar).
    easeFactor: integer("ease_factor").notNull().default(250),
    // intervalDays: jarak hari ke review berikutnya (bukan lagi tetap per box).
    intervalDays: integer("interval_days").notNull().default(0),
    // Jumlah kali lupa berturut-turut (untuk deteksi leech).
    lapses: integer("lapses").notNull().default(0),
    lastReviewedAt: text("last_reviewed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("vocab_progress_user_word_idx").on(table.userId, table.vocabularyId),
    index("vocab_progress_user_due_idx").on(table.userId, table.dueAt),
  ],
);

export const grammarLessons = sqliteTable(
  "grammar_lessons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    level: text("level", { enum: ["basic", "intermediate", "advanced"] })
      .notNull()
      .default("intermediate"),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("grammar_lessons_slug_idx").on(table.slug),
    index("grammar_lessons_order_idx").on(table.orderIndex),
  ],
);

export const grammarLessonProgress = sqliteTable(
  "grammar_lesson_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => grammarLessons.id, { onDelete: "cascade" }),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("grammar_progress_user_lesson_idx").on(table.userId, table.lessonId),
    index("grammar_progress_user_idx").on(table.userId),
  ],
);

// Jalur belajar (mirip peta Duolingo): unit berurutan yang isinya gabungan
// materi grammar dan set kosakata. Unit berikutnya terbuka setelah yang
// sebelumnya selesai.
export const learningUnits = sqliteTable(
  "learning_units",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    level: text("level", { enum: ["basic", "intermediate", "advanced"] })
      .notNull()
      .default("basic"),
    // Urutan tampil di peta jalur, dari atas ke bawah.
    orderIndex: integer("order_index").notNull().default(0),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("learning_units_slug_idx").on(table.slug),
    index("learning_units_order_idx").on(table.orderIndex),
  ],
);

// Isi unit: satu baris = satu langkah. kind menentukan sumber datanya.
export const learningUnitItems = sqliteTable(
  "learning_unit_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    unitId: integer("unit_id")
      .notNull()
      .references(() => learningUnits.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["grammar", "vocab"] }).notNull(),
    // Kalau grammar: slug lesson. Kalau vocab: kosong.
    refSlug: text("ref_slug"),
    // Kalau vocab: jumlah kata yang diambil dari daftar kosakata.
    vocabCount: integer("vocab_count"),
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("learning_unit_items_unit_idx").on(table.unitId, table.orderIndex)],
);

export const learningUnitProgress = sqliteTable(
  "learning_unit_progress",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    unitId: integer("unit_id")
      .notNull()
      .references(() => learningUnits.id, { onDelete: "cascade" }),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("learning_unit_progress_user_unit_idx").on(table.userId, table.unitId),
    index("learning_unit_progress_user_idx").on(table.userId),
  ],
);

// Catatan XP: satu baris = satu perolehan poin. Total XP dihitung dari jumlah ini.
export const xpEvents = sqliteTable(
  "xp_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    date: text("date").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("xp_events_user_idx").on(table.userId),
    index("xp_events_user_date_idx").on(table.userId, table.date),
  ],
);

// Tipe latihan: isian singkat, pilihan ganda, susun kata, terjemah, tulis kalimat.
export const GRAMMAR_EXERCISE_TYPES = [
  "fill",
  "choice",
  "arrange",
  "translate",
  "compose",
] as const;
export type GrammarExerciseType = (typeof GRAMMAR_EXERCISE_TYPES)[number];

export const grammarExercises = sqliteTable(
  "grammar_exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => grammarLessons.id, { onDelete: "cascade" }),
    type: text("type", { enum: GRAMMAR_EXERCISE_TYPES }).notNull(),
    // Teks soal. Untuk "fill"/"choice" bisa memuat ___ sebagai tempat kosong.
    prompt: text("prompt").notNull(),
    // Hint tambahan, misalnya terjemahan soal ke Bahasa Indonesia.
    hint: text("hint"),
    // JSON string[]: daftar opsi untuk "choice", atau kata acak untuk "arrange".
    options: text("options"),
    // JSON string[]: semua jawaban yang diterima (dibandingkan setelah normalisasi).
    answers: text("answers").notNull(),
    // Kalimat contoh/kunci yang ditampilkan setelah dijawab.
    explanation: text("explanation"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("grammar_exercises_lesson_idx").on(table.lessonId, table.orderIndex),
  ],
);

export const grammarAttempts = sqliteTable(
  "grammar_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => grammarExercises.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    correct: integer("correct", { mode: "boolean" }).notNull(),
    lastCorrectAt: text("last_correct_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("grammar_attempts_user_exercise_idx").on(table.userId, table.exerciseId),
    index("grammar_attempts_user_idx").on(table.userId),
  ],
);

export const toeflSessions = sqliteTable(
  "toefl_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    track: text("track", { enum: ["toefl", "eptr"] }).notNull().default("toefl"),
    section: text("section", { enum: ["structure", "reading", "listening", "review"] }).notNull(),
    label: text("label").notNull(),
    passage: text("passage"),
    questions: text("questions").notNull(),
    answers: text("answers"),
    completedAt: text("completed_at"),
    score: integer("score"),
    // JSON array indeks batch yang sudah selesai dibuat, untuk bagian simulasi
    // yang dibuat bertahap. Null untuk sesi biasa.
    progress: text("progress"),
    simulationId: integer("simulation_id").references(() => eprtSimulations.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("toefl_sessions_user_idx").on(table.userId),
    index("toefl_sessions_user_created_idx").on(table.userId, table.createdAt),
    index("toefl_sessions_user_track_idx").on(table.userId, table.track),
  ],
);

export const eprtSimulations = sqliteTable(
  "eprt_simulations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // JSON array: toefl_sessions.id per bagian simulasi, null kalau belum dibuat.
    parts: text("parts").notNull(),
    // JSON SimulationScore, diisi saat semua bagian selesai.
    score: text("score"),
    // JSON { listening?: string, ... }: waktu mulai tiap section (ISO), untuk timer.
    timers: text("timers"),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("eprt_simulations_user_idx").on(table.userId)],
);

// Bank soal bersama: soal hasil AI dipakai ulang untuk pengguna lain yang belum
// pernah melihatnya. Satu item = satu soal, atau satu teks/dialog beserta soalnya.
export const questionBank = sqliteTable(
  "question_bank",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    track: text("track", { enum: ["toefl", "eptr"] }).notNull(),
    kind: text("kind").notNull(),
    levelBand: text("level_band", { enum: ["low", "mid", "high"] }).notNull(),
    fingerprint: text("fingerprint").notNull(),
    skill: text("skill"),
    questionCount: integer("question_count").notNull(),
    // JSON { passage: string | null, questions: ToeflQuestion[] }
    item: text("item").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("question_bank_track_fp_idx").on(table.track, table.fingerprint),
    index("question_bank_pick_idx").on(table.track, table.kind, table.levelBand),
  ],
);

export const questionSeen = sqliteTable(
  "question_seen",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("question_seen_user_fp_idx").on(table.userId, table.fingerprint)],
);

// Kalibrasi kesulitan: berapa kali tiap soal dijawab dan berapa yang benar.
// Kuncinya sidik jari isi soal (urutan opsi tidak berpengaruh), bukan id bank.
// `levelBand` adalah level pengguna saat menjawab pertama kali.
export const questionStats = sqliteTable(
  "question_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fingerprint: text("fingerprint").notNull(),
    track: text("track", { enum: ["toefl", "eptr"] }).notNull(),
    kind: text("kind").notNull(),
    skill: text("skill"),
    levelBand: text("level_band", { enum: ["low", "mid", "high"] }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("question_stats_track_fp_idx").on(table.track, table.fingerprint)],
);

export const toeflReviews = sqliteTable(
  "toefl_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    // Sidik jari soal (sha1 pendek) supaya dedup bisa dicari di SQL, bukan
    // parse-JSON semua baris. Baris lama sebelum backfill bernilai null.
    fingerprint: text("fingerprint"),
    box: integer("box").notNull().default(0),
    dueAt: text("due_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("toefl_reviews_user_due_idx").on(table.userId, table.dueAt),
    index("toefl_reviews_user_fp_idx").on(table.userId, table.fingerprint),
    // Satu review aktif per soal per pengguna: dimanfaatkan recordResult untuk
    // dedup jawaban salah paralel (UNIQUE violation). Dibuat juga di migrasi 0010.
    uniqueIndex("toefl_reviews_user_fp_unique").on(table.userId, table.fingerprint),
  ],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("chat_messages_user_idx").on(table.userId, table.id)],
);

export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});

/** Cache audio TTS (mp3 base64) per suara+teks, diisi saat soal dibuat supaya audio langsung siap. */
export const ttsCache = sqliteTable("tts_cache", {
  key: text("key").primaryKey(),
  audio: text("audio").notNull(),
  createdAt: createdAt(),
});

export const userSettings = sqliteTable(
  "user_settings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("user_settings_user_key_idx").on(table.userId, table.key)],
);

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["vocab", "grammar", "toefl", "chat", "writing"],
    }).notNull(),
    date: text("date").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (table) => [
    index("activity_log_user_date_idx").on(table.userId, table.date),
    index("activity_log_user_kind_idx").on(table.userId, table.kind),
  ],
);

export const writingSubmissions = sqliteTable(
  "writing_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    essay: text("essay").notNull(),
    wordCount: integer("word_count").notNull(),
    // JSON WritingScore: skor per aspek + koreksi + saran.
    feedback: text("feedback").notNull(),
    total: integer("total").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("writing_submissions_user_idx").on(table.userId, table.id)],
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feature: text("feature", { enum: ["tutor", "toefl", "eptr", "writing", "grammar"] }).notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costUsd: text("cost_usd").notNull().default("0"),
    latencyMs: integer("latency_ms").notNull().default(0),
    ok: integer("ok", { mode: "boolean" }).notNull().default(true),
    date: text("date").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("ai_usage_user_date_idx").on(table.userId, table.date),
    index("ai_usage_feature_idx").on(table.feature),
    // P0: agregasi biaya harian lintas user (kill-switch anggaran).
    index("ai_usage_date_idx").on(table.date),
  ],
);

/* ── Rate limiting (anti brute-force / anti abuse) ── */
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: text("window_start").notNull(),
    updatedAt: updatedAt(),
  },
);

/* ── Audit log keamanan (login, perubahan admin) ── */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    detail: text("detail"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorId),
    index("audit_logs_action_idx").on(table.action),
  ],
);

/* ── Moderasi konten AI ── */
export const moderationFlags = sqliteTable(
  "moderation_flags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    direction: text("direction", { enum: ["input", "output"] }).notNull(),
    feature: text("feature").notNull(),
    reason: text("reason").notNull(),
    excerpt: text("excerpt").notNull(),
    // Hasil tinjauan admin. Null = belum ditinjau.
    resolution: text("resolution", { enum: ["safe", "actioned"] }),
    reviewedAt: text("reviewed_at"),
    createdAt: createdAt(),
  },
  (table) => [index("moderation_flags_user_idx").on(table.userId)],
);

/* ── Persetujuan (consent) UU PDP ── */
export const userConsents = sqliteTable(
  "user_consents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    policyVersion: text("policy_version").notNull(),
    aiDataSharing: integer("ai_data_sharing", { mode: "boolean" }).notNull().default(true),
    consentedAt: text("consented_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("user_consents_user_idx").on(table.userId)],
);

/* ── Permintaan hak subjek data (akses/hapus) ── */
export const dataRequests = sqliteTable(
  "data_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["export", "delete"] }).notNull(),
    status: text("status", { enum: ["pending", "done"] }).notNull().default("done"),
    createdAt: createdAt(),
  },
  (table) => [index("data_requests_user_idx").on(table.userId)],
);

/* ── Push subscriptions (notifikasi kartu jatuh tempo) ── */
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    keys: text("keys").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("push_subs_endpoint_idx").on(table.endpoint),
    index("push_subs_user_idx").on(table.userId),
  ],
);

export type Vocabulary = typeof vocabulary.$inferSelect;
export type NewVocabulary = typeof vocabulary.$inferInsert;
export type VocabularyProgress = typeof vocabularyProgress.$inferSelect;
export type GrammarLesson = typeof grammarLessons.$inferSelect;
export type NewGrammarLesson = typeof grammarLessons.$inferInsert;
export type GrammarLessonProgress = typeof grammarLessonProgress.$inferSelect;
export type GrammarExercise = typeof grammarExercises.$inferSelect;
export type NewGrammarExercise = typeof grammarExercises.$inferInsert;
export type GrammarAttempt = typeof grammarAttempts.$inferSelect;
export type LearningUnit = typeof learningUnits.$inferSelect;
export type NewLearningUnit = typeof learningUnits.$inferInsert;
export type LearningUnitItem = typeof learningUnitItems.$inferSelect;
export type NewLearningUnitItem = typeof learningUnitItems.$inferInsert;
export type LearningUnitProgress = typeof learningUnitProgress.$inferSelect;
export type XpEvent = typeof xpEvents.$inferSelect;
export type ToeflSession = typeof toeflSessions.$inferSelect;
export type ToeflReview = typeof toeflReviews.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;
export type AiUsage = typeof aiUsage.$inferSelect;
export type WritingSubmission = typeof writingSubmissions.$inferSelect;
export type RateLimit = typeof rateLimits.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ModerationFlag = typeof moderationFlags.$inferSelect;
export type UserConsent = typeof userConsents.$inferSelect;
export type DataRequest = typeof dataRequests.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

