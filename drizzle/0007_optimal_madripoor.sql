CREATE TABLE `tts_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`audio` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
