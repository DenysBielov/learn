CREATE TABLE `api_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text,
	`encrypted_value` text,
	`key_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CHECK ((token_hash IS NOT NULL AND token_hash != '' AND encrypted_value IS NULL) OR (token_hash IS NULL AND encrypted_value IS NOT NULL AND encrypted_value != ''))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_api_tokens_user_gemini` ON `api_tokens`(`user_id`, `type`) WHERE `type` IN ('gemini', 'openai');
