PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chat_conversation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`flashcard_id` integer,
	`question_id` integer,
	`session_id` integer,
	`material_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcard`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `quiz_question`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `study_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_conv_scope_exactly_one" CHECK(
  (CASE WHEN "__new_chat_conversation"."flashcard_id" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "__new_chat_conversation"."question_id" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "__new_chat_conversation"."session_id" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "__new_chat_conversation"."material_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
)
);
--> statement-breakpoint
INSERT INTO `__new_chat_conversation`("id", "user_id", "flashcard_id", "question_id", "session_id", "created_at", "updated_at") SELECT "id", "user_id", "flashcard_id", "question_id", "session_id", "created_at", "updated_at" FROM `chat_conversation`;--> statement-breakpoint
DROP TABLE `chat_conversation`;--> statement-breakpoint
ALTER TABLE `__new_chat_conversation` RENAME TO `chat_conversation`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_flashcard` ON `chat_conversation` (`user_id`,`flashcard_id`) WHERE "chat_conversation"."flashcard_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_question` ON `chat_conversation` (`user_id`,`question_id`) WHERE "chat_conversation"."question_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_session` ON `chat_conversation` (`user_id`,`session_id`) WHERE "chat_conversation"."session_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conv_user_material` ON `chat_conversation` (`user_id`,`material_id`) WHERE "chat_conversation"."material_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `material` ADD `notes` text;