import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@flashcards/database/schema";
import fs from "fs";
import path from "path";
import type { AppDatabase } from "@flashcards/database";

const { users, quizzes, quizQuestions, questionOptions, studySessions, decks } = schema;

export function createTestDb(): { db: AppDatabase; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Resolve relative to this file: tools/__tests__ -> tools -> src -> mcp-server -> packages -> database/src/migrations
  const migrationsDir = path.resolve(import.meta.dirname, "../../../../database/src/migrations");
  const sqlFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of sqlFiles) {
    const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    const statements = sqlContent.split("--> statement-breakpoint");
    for (const stmt of statements) {
      const trimmed = stmt.replace(/^\s*--[^\n]*\n/gm, "").trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }

  const db = drizzle(sqlite, { schema }) as unknown as AppDatabase;
  return { db, sqlite };
}

export interface TestCtx {
  db: AppDatabase;
  sqlite: Database.Database;
  userId: number;
  otherUserId: number;
  quizId: number;
  questionId: number;
  optionACorrectId: number;
  optionBWrongId: number;
}

export function setupQuizFixture(): TestCtx {
  const { db, sqlite } = createTestDb();

  db.insert(users).values([
    { id: 1, email: "owner@x.com" },
    { id: 2, email: "other@x.com" },
  ]).run();

  db.insert(quizzes).values({ id: 1, title: "Sample", userId: 1 }).run();
  db.insert(quizQuestions).values({ id: 1, quizId: 1, type: "multiple_choice", question: "2+2?" }).run();
  db.insert(questionOptions).values([
    { id: 1, questionId: 1, optionText: "4", isCorrect: true },
    { id: 2, questionId: 1, optionText: "5", isCorrect: false },
  ]).run();
  db.insert(decks).values({ id: 1, name: "D", userId: 1 }).run();
  db.insert(studySessions).values({ id: 1, userId: 1 }).run();
  sqlite.prepare(
    "INSERT INTO session_activity (id, session_id, type, quiz_id, started_at, completed_at) VALUES (?,?,?,?,?,?)"
  ).run(1, 1, "quiz_answer", 1, 1_700_000_000, 1_700_000_500);

  return {
    db, sqlite,
    userId: 1, otherUserId: 2,
    quizId: 1, questionId: 1,
    optionACorrectId: 1, optionBWrongId: 2,
  };
}
