CREATE TABLE `learning_unit_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`unit_id` integer NOT NULL,
	`kind` text NOT NULL,
	`ref_slug` text,
	`vocab_count` integer,
	`title` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `learning_units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `learning_unit_items_unit_idx` ON `learning_unit_items` (`unit_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `learning_unit_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `learning_units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_unit_progress_user_unit_idx` ON `learning_unit_progress` (`user_id`,`unit_id`);--> statement-breakpoint
CREATE INDEX `learning_unit_progress_user_idx` ON `learning_unit_progress` (`user_id`);--> statement-breakpoint
CREATE TABLE `learning_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`level` text DEFAULT 'basic' NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_units_slug_idx` ON `learning_units` (`slug`);--> statement-breakpoint
CREATE INDEX `learning_units_order_idx` ON `learning_units` (`order_index`);--> statement-breakpoint
CREATE TABLE `xp_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `xp_events_user_idx` ON `xp_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `xp_events_user_date_idx` ON `xp_events` (`user_id`,`date`);--> statement-breakpoint
ALTER TABLE `vocabulary` ADD `frequency_rank` integer;--> statement-breakpoint
CREATE INDEX `vocabulary_frequency_idx` ON `vocabulary` (`frequency_rank`);