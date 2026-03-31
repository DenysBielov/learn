CREATE TABLE `entity_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`vote` integer NOT NULL,
	`comment` text,
	`is_reviewed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_entity_feedback_unique` ON `entity_feedback` (`user_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_feedback_entity` ON `entity_feedback` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_feedback_reviewed` ON `entity_feedback` (`entity_type`,`is_reviewed`);