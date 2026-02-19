-- Add mcp_token_hash to users
ALTER TABLE `users` ADD `mcp_token_hash` text;
--> statement-breakpoint
-- Add user_id to deck (FK enforced at ORM level; SQLite ALTER TABLE cannot add REFERENCES with non-NULL default)
ALTER TABLE `deck` ADD `user_id` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE INDEX `idx_deck_user` ON `deck` (`user_id`);
--> statement-breakpoint
-- Add user_id to course
ALTER TABLE `course` ADD `user_id` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE INDEX `idx_course_user` ON `course` (`user_id`);
--> statement-breakpoint
-- Change tag unique constraint from UNIQUE(name) to UNIQUE(name, user_id)
DROP INDEX IF EXISTS `tag_name_unique`;
--> statement-breakpoint
ALTER TABLE `tag` ADD `user_id` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tag_name_user` ON `tag` (`name`, `user_id`);
--> statement-breakpoint
-- Add user_id to study_session
ALTER TABLE `study_session` ADD `user_id` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE INDEX `idx_study_session_user` ON `study_session` (`user_id`);
