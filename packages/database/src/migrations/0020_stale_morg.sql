ALTER TABLE `course` ADD `public_id` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL;--> statement-breakpoint
ALTER TABLE `course` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `course` ADD `root_course_id` integer REFERENCES course(id);--> statement-breakpoint
ALTER TABLE `course` ADD `forked_from_id` integer REFERENCES course(id);--> statement-breakpoint
ALTER TABLE `course` ADD `forked_from_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `course` ADD `forked_from_name` text;--> statement-breakpoint
ALTER TABLE `course` ADD `forked_from_author_name` text;--> statement-breakpoint
ALTER TABLE `course` ADD `forked_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `course_public_id_unique` ON `course` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_courses_visibility` ON `course` (`visibility`);