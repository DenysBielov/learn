import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../schema.js";
import { initFts } from "../fts.js";
import { eq } from "drizzle-orm";
import path from "path";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../migrations") });
  initFts(sqlite);
  return { db, sqlite };
}

describe("Schema", () => {
  let db: ReturnType<typeof createTestDb>["db"];
  let sqlite: Database.Database;

  beforeEach(() => {
    const ctx = createTestDb();
    db = ctx.db;
    sqlite = ctx.sqlite;
  });

  afterEach(() => {
    sqlite.close();
  });

  it("creates a deck and retrieves it", () => {
    const [deck] = db.insert(schema.decks).values({ name: "TypeScript" }).returning().all();
    expect(deck.name).toBe("TypeScript");
    expect(deck.id).toBe(1);
  });

  it("creates flashcards in a deck", () => {
    const [deck] = db.insert(schema.decks).values({ name: "Test" }).returning().all();
    db.insert(schema.flashcards).values([
      { deckId: deck.id, front: "Q1", back: "A1" },
      { deckId: deck.id, front: "Q2", back: "A2" },
    ]).run();
    const cards = db.select().from(schema.flashcards).where(eq(schema.flashcards.deckId, deck.id)).all();
    expect(cards).toHaveLength(2);
  });

  it("creates quiz questions with options", () => {
    const [deck] = db.insert(schema.decks).values({ name: "Test" }).returning().all();
    const [question] = db.insert(schema.quizQuestions).values({
      deckId: deck.id,
      type: "multiple_choice",
      question: "What is 1+1?",
    }).returning().all();
    db.insert(schema.questionOptions).values([
      { questionId: question.id, optionText: "1", isCorrect: false },
      { questionId: question.id, optionText: "2", isCorrect: true },
      { questionId: question.id, optionText: "3", isCorrect: false },
    ]).run();
    const options = db.select().from(schema.questionOptions).where(eq(schema.questionOptions.questionId, question.id)).all();
    expect(options).toHaveLength(3);
    expect(options.find(o => o.isCorrect)?.optionText).toBe("2");
  });

  it("cascades deletes from deck to flashcards", () => {
    const [deck] = db.insert(schema.decks).values({ name: "Test" }).returning().all();
    db.insert(schema.flashcards).values({ deckId: deck.id, front: "Q", back: "A" }).run();
    db.delete(schema.decks).where(eq(schema.decks.id, deck.id)).run();
    const cards = db.select().from(schema.flashcards).all();
    expect(cards).toHaveLength(0);
  });

  it("FTS5 search finds flashcards", () => {
    const [deck] = db.insert(schema.decks).values({ name: "Test" }).returning().all();
    db.insert(schema.flashcards).values([
      { deckId: deck.id, front: "What is TypeScript?", back: "A typed superset of JavaScript" },
      { deckId: deck.id, front: "What is Python?", back: "An interpreted language" },
    ]).run();
    const results = sqlite.prepare(
      `SELECT rowid, front, back FROM flashcard_fts WHERE flashcard_fts MATCH ?`
    ).all('"TypeScript"');
    expect(results).toHaveLength(1);
  });
});
