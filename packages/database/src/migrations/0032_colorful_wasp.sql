PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quiz_result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer,
	`activity_id` integer,
	`question_id` integer NOT NULL,
	`selected_option_id` integer,
	`correct` integer NOT NULL,
	`user_answer` text DEFAULT '',
	`time_spent_ms` integer DEFAULT 0,
	`confidence` integer,
	`note` text,
	`answered_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `study_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `session_activity`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`question_id`) REFERENCES `quiz_question`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`selected_option_id`) REFERENCES `question_option`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_quiz_result_confidence" CHECK(confidence IS NULL OR (confidence BETWEEN 1 AND 5))
);
--> statement-breakpoint
INSERT INTO `__new_quiz_result`("id", "session_id", "activity_id", "question_id", "correct", "user_answer", "time_spent_ms") SELECT "id", "session_id", "activity_id", "question_id", "correct", "user_answer", "time_spent_ms" FROM `quiz_result`;--> statement-breakpoint
DROP TABLE `quiz_result`;--> statement-breakpoint
ALTER TABLE `__new_quiz_result` RENAME TO `quiz_result`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_quiz_result_session` ON `quiz_result` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_quiz_result_activity` ON `quiz_result` (`activity_id`);--> statement-breakpoint
CREATE INDEX `idx_quiz_result_question_correct` ON `quiz_result` (`question_id`,`correct`);--> statement-breakpoint
CREATE INDEX `idx_quiz_result_answered_at` ON `quiz_result` (`answered_at`);