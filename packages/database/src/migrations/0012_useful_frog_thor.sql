CREATE TABLE `learning_material` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`flashcard_id` integer,
	`question_id` integer,
	`url` text NOT NULL,
	`title` text,
	`type` text DEFAULT 'article' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcard`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `quiz_question`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK ((`flashcard_id` IS NOT NULL AND `question_id` IS NULL) OR (`flashcard_id` IS NULL AND `question_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_learning_material_flashcard` ON `learning_material` (`flashcard_id`) WHERE `flashcard_id` IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_learning_material_question` ON `learning_material` (`question_id`) WHERE `question_id` IS NOT NULL;