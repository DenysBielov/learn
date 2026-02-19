// Docker-specific migration entry point with hardcoded paths.
// Plain ESM JS — no transpiler needed at runtime.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";

const DB_PATH = "/app/data/flashcards.db";
const MIGRATIONS_DIR = "/app/migrate/migrations";

const dir = "/app/data";
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { mode: 0o700, recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("defer_foreign_keys = ON");

// Pre-migration check for multi-account migration
const hasUserIdColumn = sqlite.prepare(
  "SELECT COUNT(*) as count FROM pragma_table_info('deck') WHERE name = 'user_id'"
).get();

const hasUsersTable = sqlite.prepare(
  "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name = 'users'"
).get();

if (!hasUserIdColumn.count && hasUsersTable.count) {
  // user_id column doesn't exist yet but users table does — the multi-account migration will run
  const userCount = sqlite.prepare("SELECT COUNT(*) as count FROM users").get();
  const user1 = sqlite.prepare("SELECT id FROM users WHERE id = 1").get();

  if (!user1 || userCount.count > 1) {
    console.error("ERROR: Multi-account migration requires exactly one user with id=1.");
    console.error(`Found ${userCount.count} user(s). User with id=1: ${user1 ? "exists" : "missing"}`);
    sqlite.close();
    process.exit(1);
  }
}

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: MIGRATIONS_DIR });
console.log("Migrations applied successfully");

sqlite.close();
