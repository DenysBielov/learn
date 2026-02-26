-- Step 1: Create session_activity table
CREATE TABLE `session_activity` (
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
    (type = 'quiz_answer' AND material_id IS NULL AND NOT (deck_id IS NOT NULL AND quiz_id IS NOT NULL)) OR
    (type = 'reading' AND material_id IS NOT NULL AND deck_id IS NULL AND quiz_id IS NULL)
  )
);--> statement-breakpoint

CREATE INDEX `idx_session_activity_session` ON `session_activity` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_session_activity_deck` ON `session_activity` (`deck_id`);--> statement-breakpoint
CREATE INDEX `idx_session_activity_quiz` ON `session_activity` (`quiz_id`);--> statement-breakpoint

-- Step 2: Migrate existing session data into session_activity rows

-- Flashcard sessions with a deck_id
INSERT INTO session_activity (session_id, type, deck_id, started_at, completed_at)
SELECT id, 'flashcard_review', deck_id, started_at, completed_at
FROM study_session WHERE mode = 'flashcard' AND deck_id IS NOT NULL;--> statement-breakpoint

-- Course-based flashcard sessions with deck_id NULL
INSERT INTO session_activity (session_id, type, started_at, completed_at)
SELECT id, 'flashcard_review', started_at, completed_at
FROM study_session WHERE mode = 'flashcard' AND deck_id IS NULL;--> statement-breakpoint

-- Quiz sessions with a quiz_id (standalone quiz via startQuizStudySession)
INSERT INTO session_activity (session_id, type, quiz_id, started_at, completed_at)
SELECT id, 'quiz_answer', quiz_id, started_at, completed_at
FROM study_session WHERE mode = 'quiz' AND quiz_id IS NOT NULL;--> statement-breakpoint

-- Quiz sessions with a deck_id but no quiz_id (deck-based quiz via startStudySession(deckId, "quiz"))
INSERT INTO session_activity (session_id, type, deck_id, started_at, completed_at)
SELECT id, 'quiz_answer', deck_id, started_at, completed_at
FROM study_session WHERE mode = 'quiz' AND deck_id IS NOT NULL AND quiz_id IS NULL;--> statement-breakpoint

-- Course-based quiz sessions with neither deck_id nor quiz_id
INSERT INTO session_activity (session_id, type, started_at, completed_at)
SELECT id, 'quiz_answer', started_at, completed_at
FROM study_session WHERE mode = 'quiz' AND deck_id IS NULL AND quiz_id IS NULL;--> statement-breakpoint

-- Reading sessions with a material_id
INSERT INTO session_activity (session_id, type, material_id, started_at, completed_at)
SELECT id, 'reading', material_id, started_at, completed_at
FROM study_session WHERE mode = 'reading' AND material_id IS NOT NULL;--> statement-breakpoint

-- Step 3: Recreate study_session without dropped columns, adding discarded_at
CREATE TABLE `__new_study_session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL DEFAULT 1,
	`course_id` integer,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`discarded_at` integer,
	`summary` text,
	`notes` text,
	`title` text,
	`insights` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

INSERT INTO `__new_study_session`(`id`, `user_id`, `course_id`, `started_at`, `completed_at`, `summary`, `notes`, `title`, `insights`)
SELECT `id`, `user_id`, `course_id`, `started_at`, `completed_at`, `summary`, `notes`, `title`, `insights`
FROM `study_session`;--> statement-breakpoint

DROP TABLE `study_session`;--> statement-breakpoint
ALTER TABLE `__new_study_session` RENAME TO `study_session`;--> statement-breakpoint

CREATE INDEX `idx_study_session_course` ON `study_session` (`course_id`);--> statement-breakpoint
CREATE INDEX `idx_study_session_started_at` ON `study_session` (`started_at`);--> statement-breakpoint
CREATE INDEX `idx_study_session_user` ON `study_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_study_session_user_active` ON `study_session` (`user_id`, `discarded_at`, `started_at`);--> statement-breakpoint

-- Step 4: Recreate flashcard_result with activity_id and nullable session_id
CREATE TABLE `__new_flashcard_result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer,
	`activity_id` integer,
	`flashcard_id` integer NOT NULL,
	`correct` integer NOT NULL,
	`user_answer` text DEFAULT '',
	`time_spent_ms` integer DEFAULT 0,
	FOREIGN KEY (`session_id`) REFERENCES `study_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `session_activity`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcard`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

INSERT INTO `__new_flashcard_result`(`id`, `session_id`, `flashcard_id`, `correct`, `user_answer`, `time_spent_ms`)
SELECT `id`, `session_id`, `flashcard_id`, `correct`, `user_answer`, `time_spent_ms`
FROM `flashcard_result`;--> statement-breakpoint

DROP TABLE `flashcard_result`;--> statement-breakpoint
ALTER TABLE `__new_flashcard_result` RENAME TO `flashcard_result`;--> statement-breakpoint

-- Step 5: Recreate quiz_result with activity_id and nullable session_id
CREATE TABLE `__new_quiz_result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer,
	`activity_id` integer,
	`question_id` integer NOT NULL,
	`correct` integer NOT NULL,
	`user_answer` text DEFAULT '',
	`time_spent_ms` integer DEFAULT 0,
	FOREIGN KEY (`session_id`) REFERENCES `study_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `session_activity`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`question_id`) REFERENCES `quiz_question`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

INSERT INTO `__new_quiz_result`(`id`, `session_id`, `question_id`, `correct`, `user_answer`, `time_spent_ms`)
SELECT `id`, `session_id`, `question_id`, `correct`, `user_answer`, `time_spent_ms`
FROM `quiz_result`;--> statement-breakpoint

DROP TABLE `quiz_result`;--> statement-breakpoint
ALTER TABLE `__new_quiz_result` RENAME TO `quiz_result`;--> statement-breakpoint

-- Step 6: Match existing results to their activities
UPDATE flashcard_result SET activity_id = (
  SELECT sa.id FROM session_activity sa
  WHERE sa.session_id = flashcard_result.session_id
  ORDER BY sa.id ASC LIMIT 1
);--> statement-breakpoint

UPDATE quiz_result SET activity_id = (
  SELECT sa.id FROM session_activity sa
  WHERE sa.session_id = quiz_result.session_id
  ORDER BY sa.id ASC LIMIT 1
);--> statement-breakpoint

-- Step 7: Recreate result indexes
CREATE INDEX `idx_flashcard_result_session` ON `flashcard_result` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_flashcard_result_activity` ON `flashcard_result` (`activity_id`);--> statement-breakpoint
CREATE INDEX `idx_flashcard_result_card_correct` ON `flashcard_result` (`flashcard_id`, `correct`);--> statement-breakpoint
CREATE INDEX `idx_quiz_result_session` ON `quiz_result` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_quiz_result_activity` ON `quiz_result` (`activity_id`);--> statement-breakpoint
CREATE INDEX `idx_quiz_result_question_correct` ON `quiz_result` (`question_id`, `correct`);