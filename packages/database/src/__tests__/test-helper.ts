import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema";
import fs from "fs";
import path from "path";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Run all migrations in order
  const migrationsDir = path.resolve(import.meta.dirname, "../migrations");
  const sqlFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of sqlFiles) {
    const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    // Split on statement breakpoints and execute each statement
    const statements = sqlContent.split("--> statement-breakpoint");
    for (const stmt of statements) {
      // Strip leading comment lines, then execute if there's actual SQL
      const trimmed = stmt.replace(/^\s*--[^\n]*\n/gm, "").trim();
      if (trimmed) {
        sqlite.exec(trimmed);
      }
    }
  }

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
