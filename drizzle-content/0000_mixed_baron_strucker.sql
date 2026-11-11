CREATE TABLE `listening_audio` (
	`talk_id` integer PRIMARY KEY NOT NULL,
	`mp3` blob NOT NULL,
	FOREIGN KEY (`talk_id`) REFERENCES `listening_talks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `listening_questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`talk_id` integer NOT NULL,
	`skill` text NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`answer` integer NOT NULL,
	`explain_id` text NOT NULL,
	`hash` text NOT NULL,
	FOREIGN KEY (`talk_id`) REFERENCES `listening_talks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listening_questions_hash_idx` ON `listening_questions` (`hash`);--> statement-breakpoint
CREATE INDEX `listening_questions_talk_idx` ON `listening_questions` (`talk_id`);--> statement-breakpoint
CREATE TABLE `listening_talks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`level` text NOT NULL,
	`script` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listening_talks_hash_idx` ON `listening_talks` (`hash`);--> statement-breakpoint
CREATE INDEX `listening_talks_pick_idx` ON `listening_talks` (`kind`,`level`);