-- Add chat_conversation table
CREATE TABLE `chat_conversation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`flashcard_id` integer REFERENCES `flashcard`(`id`) ON DELETE CASCADE,
	`question_id` integer REFERENCES `quiz_question`(`id`) ON DELETE CASCADE,
	`session_id` integer REFERENCES `study_session`(`id`) ON DELETE CASCADE,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch()),
	CHECK ((`flashcard_id` IS NULL) != (`question_id` IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_flashcard` ON `chat_conversation`(`user_id`, `flashcard_id`) WHERE `flashcard_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_question` ON `chat_conversation`(`user_id`, `question_id`) WHERE `question_id` IS NOT NULL;
--> statement-breakpoint
-- Add chat_message table
CREATE TABLE `chat_message` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL REFERENCES `chat_conversation`(`id`) ON DELETE CASCADE,
	`role` text NOT NULL,
	`content` text,
	`image_url` text,
	`created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_chat_message_conversation` ON `chat_message` (`conversation_id`);
