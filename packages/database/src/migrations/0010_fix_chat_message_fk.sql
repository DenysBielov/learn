-- Fix chat_message foreign key: was referencing chat_conversation_old (leftover from 0009 rename)
CREATE TABLE `chat_message_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL REFERENCES `chat_conversation`(`id`) ON DELETE CASCADE,
	`role` text NOT NULL,
	`content` text,
	`image_url` text,
	`created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
INSERT INTO `chat_message_new` SELECT * FROM `chat_message`;
--> statement-breakpoint
DROP TABLE `chat_message`;
--> statement-breakpoint
ALTER TABLE `chat_message_new` RENAME TO `chat_message`;
