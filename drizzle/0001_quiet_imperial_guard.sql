CREATE TABLE `writing_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`prompt` text NOT NULL,
	`essay` text NOT NULL,
	`word_count` integer NOT NULL,
	`feedback` text NOT NULL,
	`total` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `writing_submissions_user_idx` ON `writing_submissions` (`user_id`,`id`);