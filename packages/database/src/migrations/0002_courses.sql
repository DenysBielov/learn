-- Create course table
CREATE TABLE `course` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` integer REFERENCES `course`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`color` text NOT NULL DEFAULT '#6366f1',
	`position` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch()),
	CHECK(`parent_id` IS NULL OR `parent_id` != `id`),
	CHECK(LENGTH(`name`) > 0 AND LENGTH(`name`) <= 200),
	CHECK(LENGTH(`description`) <= 2000),
	CHECK(`color` GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')
);
--> statement-breakpoint
CREATE INDEX `idx_course_parent_position` ON `course` (`parent_id`, `position`);
--> statement-breakpoint
-- Create course_deck join table (WITHOUT ROWID)
CREATE TABLE `course_deck` (
	`course_id` integer NOT NULL REFERENCES `course`(`id`) ON DELETE CASCADE,
	`deck_id` integer NOT NULL REFERENCES `deck`(`id`) ON DELETE CASCADE,
	`position` integer NOT NULL DEFAULT 0,
	PRIMARY KEY (`course_id`, `deck_id`)
) WITHOUT ROWID;
--> statement-breakpoint
CREATE INDEX `idx_course_deck_deck` ON `course_deck` (`deck_id`);
--> statement-breakpoint
-- Recreate study_session table (need to remove NOT NULL from deck_id, add course_id, sub_mode, CHECK)
PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE `study_session_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deck_id` integer REFERENCES `deck`(`id`) ON DELETE CASCADE,
	`course_id` integer REFERENCES `course`(`id`) ON DELETE CASCADE,
	`mode` text NOT NULL,
	`sub_mode` text,
	`started_at` integer NOT NULL DEFAULT (unixepoch()),
	`completed_at` integer,
	CHECK ((`deck_id` IS NOT NULL AND `course_id` IS NULL) OR (`deck_id` IS NULL AND `course_id` IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `study_session_new` (`id`, `deck_id`, `course_id`, `mode`, `sub_mode`, `started_at`, `completed_at`)
	SELECT `id`, `deck_id`, NULL, `mode`, NULL, `started_at`, `completed_at` FROM `study_session`;
--> statement-breakpoint
DROP TABLE `study_session`;
--> statement-breakpoint
ALTER TABLE `study_session_new` RENAME TO `study_session`;
--> statement-breakpoint
CREATE INDEX `idx_study_session_deck` ON `study_session` (`deck_id`);
--> statement-breakpoint
CREATE INDEX `idx_study_session_course` ON `study_session` (`course_id`);
--> statement-breakpoint
CREATE INDEX `idx_study_session_started_at` ON `study_session` (`started_at`);
--> statement-breakpoint
-- Covering composite indexes on result tables for Weakest First mode
CREATE INDEX `idx_flashcard_result_card_correct` ON `flashcard_result` (`flashcard_id`, `correct`);
--> statement-breakpoint
CREATE INDEX `idx_quiz_result_question_correct` ON `quiz_result` (`question_id`, `correct`);
