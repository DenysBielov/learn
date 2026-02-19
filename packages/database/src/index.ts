// packages/database/src/index.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { initFts } from "./fts";
import path from "path";
import fs from "fs";

// Find monorepo root by walking up from cwd looking for pnpm-workspace.yaml.
// import.meta.dirname is unavailable in Turbopack SSR, so we can't rely on it.
function findMonorepoRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const DB_PATH = process.env.DATABASE_PATH || path.join(findMonorepoRoot(), "data", "flashcards.db");

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  }
}

function createConnection() {
  ensureDataDir();
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");

  initFts(sqlite);

  try {
    fs.chmodSync(DB_PATH, 0o600);
  } catch {
    // May fail on some systems, non-critical
  }

  return sqlite;
}

let sqliteInstance: Database.Database | null = null;

function getSqlite() {
  if (!sqliteInstance) {
    sqliteInstance = createConnection();
  }
  return sqliteInstance;
}

export function getDb() {
  return drizzle(getSqlite(), { schema });
}

export type AppDatabase = ReturnType<typeof getDb>;

/**
 * Execute a write operation inside a BEGIN IMMEDIATE transaction.
 * better-sqlite3 is synchronous, so this function is synchronous.
 */
export function writeTransaction<T>(
  db: AppDatabase,
  fn: () => T
): T {
  const sqlite = getSqlite();
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    sqlite.exec("COMMIT");
    return result;
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

export function closeDb() {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
  }
}

// Re-export schema for non-Turbopack consumers (e.g. MCP server)
export * from "./schema";
export { DB_PATH };
