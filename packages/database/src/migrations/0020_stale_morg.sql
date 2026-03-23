ALTER TABLE `course` ADD `public_id` text;--> statement-breakpoint
ALTER TABLE `course` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `course` ADD `root_course_id` integer REFERENCES course(id);--> statement-breakpoint
ALTER TABLE `course` ADD `forked_from_id` integer REFERENCES course(id);--> statement-breakpoint
ALTER TABLE `course` ADD `forked_from_user_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `course` ADD `forked_from_name` text;--> statement-breakpoint
ALTER TABLE `course` ADD `forked_from_author_name` text;--> statement-breakpoint
ALTER TABLE `course` ADD `forked_at` integer;