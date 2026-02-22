CREATE TABLE `event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_events_created_at` ON `event` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_events_user_created` ON `event` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `learning_dependency` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_item_id` integer,
	`material_item_id` integer,
	`depends_on_course_id` integer,
	`depends_on_material_id` integer,
	FOREIGN KEY (`course_item_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_item_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_course_id`) REFERENCES `course`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_material_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK (
		(course_item_id IS NOT NULL AND material_item_id IS NULL) OR
		(course_item_id IS NULL AND material_item_id IS NOT NULL)
	),
	CHECK (
		(depends_on_course_id IS NOT NULL AND depends_on_material_id IS NULL) OR
		(depends_on_course_id IS NULL AND depends_on_material_id IS NOT NULL)
	)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dep_cc` ON `learning_dependency` (`course_item_id`,`depends_on_course_id`) WHERE "learning_dependency"."course_item_id" IS NOT NULL AND "learning_dependency"."depends_on_course_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dep_cm` ON `learning_dependency` (`course_item_id`,`depends_on_material_id`) WHERE "learning_dependency"."course_item_id" IS NOT NULL AND "learning_dependency"."depends_on_material_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dep_mc` ON `learning_dependency` (`material_item_id`,`depends_on_course_id`) WHERE "learning_dependency"."material_item_id" IS NOT NULL AND "learning_dependency"."depends_on_course_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dep_mm` ON `learning_dependency` (`material_item_id`,`depends_on_material_id`) WHERE "learning_dependency"."material_item_id" IS NOT NULL AND "learning_dependency"."depends_on_material_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `material_deck` (
	`material_id` integer NOT NULL,
	`deck_id` integer NOT NULL,
	PRIMARY KEY(`material_id`, `deck_id`),
	FOREIGN KEY (`material_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deck_id`) REFERENCES `deck`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_material_deck_deck` ON `material_deck` (`deck_id`);--> statement-breakpoint
CREATE TABLE `material_quiz` (
	`material_id` integer NOT NULL,
	`quiz_id` integer NOT NULL,
	PRIMARY KEY(`material_id`, `quiz_id`),
	FOREIGN KEY (`material_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quiz`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_material_quiz_quiz` ON `material_quiz` (`quiz_id`);--> statement-breakpoint
CREATE TABLE `material_resource` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`material_id` integer NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`type` text DEFAULT 'other' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK(url LIKE 'http://%' OR url LIKE 'https://%')
);
--> statement-breakpoint
CREATE INDEX `idx_material_resource_material` ON `material_resource` (`material_id`);--> statement-breakpoint
CREATE TABLE `material_tag` (
	`material_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`material_id`, `tag_id`),
	FOREIGN KEY (`material_id`) REFERENCES `material`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_material_tag_material` ON `material_tag` (`material_id`);--> statement-breakpoint
CREATE INDEX `idx_material_tag_tag` ON `material_tag` (`tag_id`);--> statement-breakpoint
ALTER TABLE `course` ADD `estimated_hours` integer;--> statement-breakpoint
ALTER TABLE `flashcard` ADD `source_material_id` integer REFERENCES material(id);--> statement-breakpoint
ALTER TABLE `quiz_question` ADD `source_material_id` integer REFERENCES material(id);--> statement-breakpoint
ALTER TABLE `study_session` ADD `material_id` integer REFERENCES material(id);--> statement-breakpoint
ALTER TABLE `study_session` ADD `summary` text;--> statement-breakpoint
CREATE INDEX `idx_study_session_material` ON `study_session` (`material_id`);