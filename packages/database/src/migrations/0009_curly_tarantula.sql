DROP INDEX `idx_conv_user_flashcard`;--> statement-breakpoint
DROP INDEX `idx_conv_user_question`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_session` ON `chat_conversation` (`user_id`,`session_id`) WHERE "chat_conversation"."session_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_flashcard` ON `chat_conversation` (`user_id`,`flashcard_id`) WHERE "chat_conversation"."flashcard_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_question` ON `chat_conversation` (`user_id`,`question_id`) WHERE "chat_conversation"."question_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `study_session` ADD `notes` text;
--> statement-breakpoint
-- Rebuild chat_conversation to replace CHECK constraint
-- Old CHECK: (flashcard_id IS NULL) != (question_id IS NULL)  -- requires exactly one
-- New CHECK: at least one of flashcard_id, question_id, or session_id must be set
ALTER TABLE `chat_conversation` RENAME TO `chat_conversation_old`;
--> statement-breakpoint
CREATE TABLE `chat_conversation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`flashcard_id` integer REFERENCES `flashcard`(`id`) ON DELETE CASCADE,
	`question_id` integer REFERENCES `quiz_question`(`id`) ON DELETE CASCADE,
	`session_id` integer REFERENCES `study_session`(`id`) ON DELETE CASCADE,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch()),
	CHECK (`flashcard_id` IS NOT NULL OR `question_id` IS NOT NULL OR `session_id` IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `chat_conversation` (`id`, `user_id`, `flashcard_id`, `question_id`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `flashcard_id`, `question_id`, `created_at`, `updated_at` FROM `chat_conversation_old`;
--> statement-breakpoint
DROP TABLE `chat_conversation_old`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_flashcard` ON `chat_conversation`(`user_id`, `flashcard_id`) WHERE `flashcard_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_question` ON `chat_conversation`(`user_id`, `question_id`) WHERE `question_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_session` ON `chat_conversation`(`user_id`, `session_id`) WHERE `session_id` IS NOT NULL;
