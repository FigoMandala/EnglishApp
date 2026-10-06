CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`date` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_log_user_date_idx` ON `activity_log` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `activity_log_user_kind_idx` ON `activity_log` (`user_id`,`kind`);--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`feature` text NOT NULL,
	`model` text NOT NULL,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`completion_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` text DEFAULT '0' NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`ok` integer DEFAULT true NOT NULL,
	`date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_usage_user_date_idx` ON `ai_usage` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `ai_usage_feature_idx` ON `ai_usage` (`feature`);--> statement-breakpoint
CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_messages_user_idx` ON `chat_messages` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `eprt_simulations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`parts` text NOT NULL,
	`score` text,
	`timers` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `eprt_simulations_user_idx` ON `eprt_simulations` (`user_id`);--> statement-breakpoint
CREATE TABLE `grammar_lesson_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`lesson_id` integer NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `grammar_lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_progress_user_lesson_idx` ON `grammar_lesson_progress` (`user_id`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `grammar_progress_user_idx` ON `grammar_lesson_progress` (`user_id`);--> statement-breakpoint
CREATE TABLE `grammar_lessons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`level` text DEFAULT 'intermediate' NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_lessons_slug_idx` ON `grammar_lessons` (`slug`);--> statement-breakpoint
CREATE INDEX `grammar_lessons_order_idx` ON `grammar_lessons` (`order_index`);--> statement-breakpoint
CREATE TABLE `question_bank` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track` text NOT NULL,
	`kind` text NOT NULL,
	`level_band` text NOT NULL,
	`fingerprint` text NOT NULL,
	`skill` text,
	`question_count` integer NOT NULL,
	`item` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_bank_track_fp_idx` ON `question_bank` (`track`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `question_bank_pick_idx` ON `question_bank` (`track`,`kind`,`level_band`);--> statement-breakpoint
CREATE TABLE `question_seen` (
	`user_id` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_seen_user_fp_idx` ON `question_seen` (`user_id`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `toefl_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`question` text NOT NULL,
	`box` integer DEFAULT 0 NOT NULL,
	`due_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `toefl_reviews_user_due_idx` ON `toefl_reviews` (`user_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `toefl_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`track` text DEFAULT 'toefl' NOT NULL,
	`section` text NOT NULL,
	`label` text NOT NULL,
	`passage` text,
	`questions` text NOT NULL,
	`answers` text,
	`completed_at` text,
	`score` integer,
	`simulation_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`simulation_id`) REFERENCES `eprt_simulations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `toefl_sessions_user_idx` ON `toefl_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `toefl_sessions_user_created_idx` ON `toefl_sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `toefl_sessions_user_track_idx` ON `toefl_sessions` (`user_id`,`track`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_key_idx` ON `user_settings` (`user_id`,`key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`username_lower` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_lower_idx` ON `users` (`username_lower`);--> statement-breakpoint
CREATE TABLE `vocabulary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`word_lower` text NOT NULL,
	`meaning` text NOT NULL,
	`phonetic` text,
	`part_of_speech` text,
	`example_en` text,
	`example_id` text,
	`level` text DEFAULT 'intermediate' NOT NULL,
	`topic` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocabulary_word_lower_idx` ON `vocabulary` (`word_lower`);--> statement-breakpoint
CREATE INDEX `vocabulary_level_idx` ON `vocabulary` (`level`);--> statement-breakpoint
CREATE TABLE `vocabulary_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`vocabulary_id` integer NOT NULL,
	`box` integer DEFAULT 0 NOT NULL,
	`due_at` text NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`last_reviewed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vocabulary_id`) REFERENCES `vocabulary`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_progress_user_word_idx` ON `vocabulary_progress` (`user_id`,`vocabulary_id`);--> statement-breakpoint
CREATE INDEX `vocab_progress_user_due_idx` ON `vocabulary_progress` (`user_id`,`due_at`);