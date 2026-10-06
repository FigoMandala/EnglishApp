CREATE TABLE `grammar_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`answer` text NOT NULL,
	`correct` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `grammar_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_attempts_user_exercise_idx` ON `grammar_attempts` (`user_id`,`exercise_id`);--> statement-breakpoint
CREATE INDEX `grammar_attempts_user_idx` ON `grammar_attempts` (`user_id`);--> statement-breakpoint
CREATE TABLE `grammar_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_id` integer NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`hint` text,
	`options` text,
	`answers` text NOT NULL,
	`explanation` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `grammar_lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `grammar_exercises_lesson_idx` ON `grammar_exercises` (`lesson_id`,`order_index`);