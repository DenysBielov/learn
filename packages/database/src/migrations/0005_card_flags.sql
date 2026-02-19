CREATE TABLE `card_flag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`),
	`flashcard_id` integer REFERENCES `flashcard`(`id`) ON DELETE CASCADE,
	`question_id` integer REFERENCES `quiz_question`(`id`) ON DELETE CASCADE,
	`flag_type` text NOT NULL,
	`comment` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CHECK ((`flashcard_id` IS NOT NULL AND `question_id` IS NULL) OR (`flashcard_id` IS NULL AND `question_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_card_flag_user` ON `card_flag` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_card_flag_flashcard` ON `card_flag` (`flashcard_id`) WHERE `flashcard_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_card_flag_question` ON `card_flag` (`question_id`) WHERE `question_id` IS NOT NULL;
