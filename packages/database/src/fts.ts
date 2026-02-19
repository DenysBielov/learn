// packages/database/src/fts.ts
import type Database from "better-sqlite3";

export function initFts(sqlite: Database.Database) {
  // FTS5 virtual tables
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS flashcard_fts USING fts5(
      front, back, content=flashcard, content_rowid=id
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS question_fts USING fts5(
      question, explanation, content=quiz_question, content_rowid=id
    );
  `);

  // Flashcard FTS triggers
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS flashcard_fts_insert AFTER INSERT ON flashcard BEGIN
      INSERT INTO flashcard_fts(rowid, front, back) VALUES (new.id, new.front, new.back);
    END;

    CREATE TRIGGER IF NOT EXISTS flashcard_fts_delete AFTER DELETE ON flashcard BEGIN
      INSERT INTO flashcard_fts(flashcard_fts, rowid, front, back) VALUES('delete', old.id, old.front, old.back);
    END;

    CREATE TRIGGER IF NOT EXISTS flashcard_fts_update AFTER UPDATE ON flashcard BEGIN
      INSERT INTO flashcard_fts(flashcard_fts, rowid, front, back) VALUES('delete', old.id, old.front, old.back);
      INSERT INTO flashcard_fts(rowid, front, back) VALUES (new.id, new.front, new.back);
    END;
  `);

  // QuizQuestion FTS triggers
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS question_fts_insert AFTER INSERT ON quiz_question BEGIN
      INSERT INTO question_fts(rowid, question, explanation) VALUES (new.id, new.question, new.explanation);
    END;

    CREATE TRIGGER IF NOT EXISTS question_fts_delete AFTER DELETE ON quiz_question BEGIN
      INSERT INTO question_fts(question_fts, rowid, question, explanation) VALUES('delete', old.id, old.question, old.explanation);
    END;

    CREATE TRIGGER IF NOT EXISTS question_fts_update AFTER UPDATE ON quiz_question BEGIN
      INSERT INTO question_fts(question_fts, rowid, question, explanation) VALUES('delete', old.id, old.question, old.explanation);
      INSERT INTO question_fts(rowid, question, explanation) VALUES (new.id, new.question, new.explanation);
    END;
  `);
}
