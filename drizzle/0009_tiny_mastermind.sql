ALTER TABLE `toefl_reviews` ADD `fingerprint` text;--> statement-breakpoint
CREATE INDEX `toefl_reviews_user_fp_idx` ON `toefl_reviews` (`user_id`,`fingerprint`);