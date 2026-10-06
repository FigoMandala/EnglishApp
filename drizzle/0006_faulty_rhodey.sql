CREATE TABLE `question_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fingerprint` text NOT NULL,
	`track` text NOT NULL,
	`kind` text NOT NULL,
	`skill` text,
	`level_band` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_stats_track_fp_idx` ON `question_stats` (`track`,`fingerprint`);