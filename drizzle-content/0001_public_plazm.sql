DROP INDEX `listening_talks_pick_idx`;--> statement-breakpoint
ALTER TABLE `listening_talks` ADD `language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE INDEX `listening_talks_pick_idx` ON `listening_talks` (`language`,`kind`,`level`);