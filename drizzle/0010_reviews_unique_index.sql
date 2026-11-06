-- Indeks unik "satu review aktif per soal per pengguna" kini dibuat lewat
-- migrasi (sebelumnya hanya lewat skrip npm run db:dedup-reviews, sehingga
-- environment baru kehilangan jaring pengaman dedup di recordResult).
-- 1) Samakan box tiap grup dengan box tertinggi grup, seperti db:dedup-reviews.
UPDATE `toefl_reviews`
SET `box` = (
  SELECT max(`r2`.`box`) FROM `toefl_reviews` `r2`
  WHERE `r2`.`user_id` = `toefl_reviews`.`user_id` AND `r2`.`fingerprint` = `toefl_reviews`.`fingerprint`
)
WHERE `fingerprint` IS NOT NULL;--> statement-breakpoint
-- 2) Hapus duplikat: pertahankan baris id terkecil tiap grup (user_id, fingerprint).
DELETE FROM `toefl_reviews` WHERE `fingerprint` IS NOT NULL AND `id` NOT IN (
  SELECT min(`id`) FROM `toefl_reviews` WHERE `fingerprint` IS NOT NULL GROUP BY `user_id`, `fingerprint`
);--> statement-breakpoint
-- 3) Unique index (baris fingerprint null tidak saling bentrok di SQLite).
CREATE UNIQUE INDEX IF NOT EXISTS `toefl_reviews_user_fp_unique` ON `toefl_reviews` (`user_id`,`fingerprint`);
