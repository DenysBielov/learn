import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "./test-helper";
import { users, quizzes, quizQuestions, questionOptions, studySessions, sessionActivities, quizResults } from "../schema";
import { sql } from "drizzle-orm";
import type { AppDatabase } from "../index";

let db: AppDatabase;
let sqlite: Database.Database;

beforeEach(() => {
  const t = createTestDb();
  db = t.db;
  sqlite = t.sqlite;
});

afterEach(() => sqlite.close());

describe("quiz_result schema", () => {
  it("has the new columns and answered_at default", () => {
    db.insert(users).values({ id: 1, email: "a@b.c" }).run();
    db.insert(quizzes).values({ id: 1, title: "Q", userId: 1 }).run();
    db.insert(quizQuestions).values({ id: 1, quizId: 1, type: "multiple_choice", question: "?" }).run();
    db.insert(questionOptions).values({ id: 1, questionId: 1, optionText: "A", isCorrect: true }).run();

    db.insert(quizResults).values({
      questionId: 1,
      selectedOptionId: 1,
      correct: true,
      userAnswer: "1",
      confidence: 4,
      note: "felt sure",
    }).run();

    const row = sqlite.prepare("SELECT selected_option_id, confidence, note, answered_at FROM quiz_result").get() as any;
    expect(row.selected_option_id).toBe(1);
    expect(row.confidence).toBe(4);
    expect(row.note).toBe("felt sure");
    expect(typeof row.answered_at).toBe("number");
    expect(row.answered_at).toBeGreaterThan(0);
  });

  it("rejects confidence outside 1..5", () => {
    db.insert(users).values({ id: 1, email: "a@b.c" }).run();
    db.insert(quizzes).values({ id: 1, title: "Q", userId: 1 }).run();
    db.insert(quizQuestions).values({ id: 1, quizId: 1, type: "multiple_choice", question: "?" }).run();
    expect(() =>
      db.insert(quizResults).values({ questionId: 1, correct: false, confidence: 7 }).run()
    ).toThrow();
  });

  it("backfills answered_at from session_activity for legacy rows", () => {
    // Simulate a legacy row by manually setting answered_at to a marker, then
    // re-running the backfill statement (the migration file).
    db.insert(users).values({ id: 1, email: "a@b.c" }).run();
    db.insert(quizzes).values({ id: 1, title: "Q", userId: 1 }).run();
    db.insert(quizQuestions).values({ id: 1, quizId: 1, type: "multiple_choice", question: "?" }).run();
    db.insert(studySessions).values({ id: 1, userId: 1 }).run();

    const startedAt = 1_700_000_000;
    const completedAt = 1_700_000_500;
    sqlite.prepare(
      "INSERT INTO session_activity (id, session_id, type, quiz_id, started_at, completed_at) VALUES (?,?,?,?,?,?)"
    ).run(1, 1, "quiz_answer", 1, startedAt, completedAt);

    sqlite.prepare(
      "INSERT INTO quiz_result (question_id, activity_id, correct, user_answer, answered_at) VALUES (?,?,?,?,?)"
    ).run(1, 1, 1, "x", 9_999_999_999); // marker

    sqlite.exec(`
      UPDATE quiz_result
      SET answered_at = COALESCE(
        (SELECT sa.completed_at FROM session_activity sa WHERE sa.id = quiz_result.activity_id),
        (SELECT sa.started_at FROM session_activity sa WHERE sa.id = quiz_result.activity_id),
        answered_at
      )
      WHERE activity_id IS NOT NULL;
    `);

    const row = sqlite.prepare("SELECT answered_at FROM quiz_result").get() as any;
    expect(row.answered_at).toBe(completedAt);
  });
});
