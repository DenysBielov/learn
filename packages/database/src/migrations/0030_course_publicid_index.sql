CREATE UNIQUE INDEX `course_public_id_unique` ON `course` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_courses_visibility` ON `course` (`visibility`);