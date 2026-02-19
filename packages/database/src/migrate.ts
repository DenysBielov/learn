// packages/database/src/migrate.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";

const DB_PATH = path.resolve(import.meta.dirname, "../../../data/flashcards.db");

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { mode: 0o700, recursive: true });
}

// Create a raw connection without FTS init (tables may not exist yet)
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("defer_foreign_keys = ON");

// Pre-migration check for multi-account migration
const hasUserIdColumn = (sqlite.prepare(
  "SELECT COUNT(*) as count FROM pragma_table_info('deck') WHERE name = 'user_id'"
).get() as { count: number });

const hasUsersTable = (sqlite.prepare(
  "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = 'users'"
).get() as { count: number });

if (!hasUserIdColumn.count && hasUsersTable.count) {
  // user_id column doesn't exist yet but users table does — the multi-account migration will run
  const userCount = (sqlite.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number });
  const user1 = sqlite.prepare("SELECT id FROM users WHERE id = 1").get();

  if (!user1 || userCount.count > 1) {
    console.error("ERROR: Multi-account migration requires exactly one user with id=1.");
    console.error(`Found ${userCount.count} user(s). User with id=1: ${user1 ? "exists" : "missing"}`);
    sqlite.close();
    process.exit(1);
  }
}

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "./migrations") });
console.log("Migrations applied successfully");

sqlite.close();
