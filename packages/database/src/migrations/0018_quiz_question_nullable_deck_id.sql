-- Step 1: Recreate quiz_question with nullable deck_id and required quiz_id
CREATE TABLE `__new_quiz_question` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deck_id` integer,
	`quiz_id` integer NOT NULL,
	`type` text NOT NULL,
	`question` text NOT NULL,
	`explanation` text DEFAULT '',
	`correct_answer` text,
	`source_material_id` integer REFERENCES `material`(`id`),
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `deck`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint

INSERT INTO `__new_quiz_question`(`id`, `deck_id`, `quiz_id`, `type`, `question`, `explanation`, `correct_answer`, `source_material_id`, `created_at`)
SELECT `id`, `deck_id`, `quiz_id`, `type`, `question`, `explanation`, `correct_answer`, `source_material_id`, `created_at`
FROM `quiz_question`;--> statement-breakpoint

DROP TABLE `quiz_question`;--> statement-breakpoint
ALTER TABLE `__new_quiz_question` RENAME TO `quiz_question`;--> statement-breakpoint

CREATE INDEX `idx_question_deck` ON `quiz_question` (`deck_id`);--> statement-breakpoint
CREATE INDEX `idx_question_quiz` ON `quiz_question` (`quiz_id`);--> statement-breakpoint
CREATE INDEX `idx_question_type` ON `quiz_question` (`type`);--> statement-breakpoint

-- Step 2: Recreate session_activity with updated check constraint for quiz_answer
CREATE TABLE `__new_session_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`type` text NOT NULL,
	`deck_id` integer,
	`quiz_id` integer,
	`material_id` integer,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `study_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deck_id`) REFERENCES `deck`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`quiz_id`) REFERENCES `quiz`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`material_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_activity_type_source" CHECK(
    (type = 'flashcard_review' AND quiz_id IS NULL AND material_id IS NULL) OR
    (type = 'quiz_answer' AND material_id IS NULL AND deck_id IS NULL) OR
    (type = 'reading' AND material_id IS NOT NULL AND deck_id IS NULL AND quiz_id IS NULL)
  )
);--> statement-breakpoint

INSERT INTO `__new_session_activity`(`id`, `session_id`, `type`, `deck_id`, `quiz_id`, `material_id`, `started_at`, `completed_at`)
SELECT `id`, `session_id`, `type`,
  CASE WHEN `type` = 'quiz_answer' THEN NULL ELSE `deck_id` END,
  `quiz_id`, `material_id`, `started_at`, `completed_at`
FROM `session_activity`;--> statement-breakpoint

DROP TABLE `session_activity`;--> statement-breakpoint
ALTER TABLE `__new_session_activity` RENAME TO `session_activity`;--> statement-breakpoint

CREATE INDEX `idx_session_activity_session` ON `session_activity` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_session_activity_deck` ON `session_activity` (`deck_id`);--> statement-breakpoint
CREATE INDEX `idx_session_activity_quiz` ON `session_activity` (`quiz_id`);