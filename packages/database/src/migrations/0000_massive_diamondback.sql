CREATE TABLE `deck` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `flashcard_result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`flashcard_id` integer NOT NULL,
	`correct` integer NOT NULL,
	`user_answer` text DEFAULT '',
	`time_spent_ms` integer DEFAULT 0,
	FOREIGN KEY (`session_id`) REFERENCES `study_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcard`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_flashcard_result_session` ON `flashcard_result` (`session_id`);--> statement-breakpoint
CREATE TABLE `flashcard_tag` (
	`flashcard_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`flashcard_id`, `tag_id`),
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcard`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_flashcard_tag_flashcard` ON `flashcard_tag` (`flashcard_id`);--> statement-breakpoint
CREATE INDEX `idx_flashcard_tag_tag` ON `flashcard_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `flashcard` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deck_id` integer NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`ease_factor` real DEFAULT 2.5 NOT NULL,
	`interval` integer DEFAULT 0 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`next_review_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `deck`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_flashcard_next_review` ON `flashcard` (`next_review_at`,`deck_id`);--> statement-breakpoint
CREATE INDEX `idx_flashcard_deck` ON `flashcard` (`deck_id`);--> statement-breakpoint
CREATE TABLE `question_option` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer NOT NULL,
	`option_text` text NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `quiz_question`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_option_question` ON `question_option` (`question_id`);--> statement-breakpoint
CREATE TABLE `question_tag` (
	`question_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`question_id`, `tag_id`),
	FOREIGN KEY (`question_id`) REFERENCES `quiz_question`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_question_tag_question` ON `question_tag` (`question_id`);--> statement-breakpoint
CREATE INDEX `idx_question_tag_tag` ON `question_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `quiz_question` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deck_id` integer NOT NULL,
	`type` text NOT NULL,
	`question` text NOT NULL,
	`explanation` text DEFAULT '',
	`correct_answer` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `deck`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_question_deck` ON `quiz_question` (`deck_id`);--> statement-breakpoint
CREATE INDEX `idx_question_type` ON `quiz_question` (`type`);--> statement-breakpoint
CREATE TABLE `quiz_result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`correct` integer NOT NULL,
	`user_answer` text DEFAULT '',
	`time_spent_ms` integer DEFAULT 0,
	FOREIGN KEY (`session_id`) REFERENCES `study_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `quiz_question`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_quiz_result_session` ON `quiz_result` (`session_id`);--> statement-breakpoint
CREATE TABLE `study_session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deck_id` integer NOT NULL,
	`mode` text NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`deck_id`) REFERENCES `deck`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_study_session_started_at` ON `study_session` (`started_at`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_name_unique` ON `tag` (`name`);