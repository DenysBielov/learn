CREATE TABLE `course_step` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`position` integer NOT NULL,
	`step_type` text NOT NULL,
	`material_id` integer,
	`quiz_id` integer,
	FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quiz`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_course_step_course_pos` ON `course_step` (`course_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_step_material` ON `course_step` (`material_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_step_quiz` ON `course_step` (`quiz_id`);--> statement-breakpoint
CREATE TABLE `material` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`external_url` text,
	`user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_material_user` ON `material` (`user_id`);--> statement-breakpoint
CREATE TABLE `quiz` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_quiz_user` ON `quiz` (`user_id`);--> statement-breakpoint
CREATE TABLE `step_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_step_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`course_step_id`) REFERENCES `course_step`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_step_progress_step_user` ON `step_progress` (`course_step_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `quiz_question` ADD `quiz_id` integer REFERENCES quiz(id);--> statement-breakpoint
CREATE INDEX `idx_question_quiz` ON `quiz_question` (`quiz_id`);--> statement-breakpoint
ALTER TABLE `study_session` ADD `quiz_id` integer REFERENCES quiz(id);--> statement-breakpoint
CREATE INDEX `idx_study_session_quiz` ON `study_session` (`quiz_id`);