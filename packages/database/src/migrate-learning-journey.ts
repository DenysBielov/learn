// packages/database/src/migrate-learning-journey.ts
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.resolve(import.meta.dirname, "../../../data/flashcards.db");

if (!fs.existsSync(DB_PATH)) {
  console.error("Database not found at", DB_PATH);
  process.exit(1);
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = OFF"); // Must be OFF during table rebuild

console.log("Starting Phase 2 learning journey migration...");

sqlite.exec("BEGIN IMMEDIATE");

try {
  // ── Step 1: Rebuild quiz_question ──────────────────────────────────────
  // Make deck_id nullable, change cascade from CASCADE to SET NULL
  // Keep quiz_id with ON DELETE CASCADE
  console.log("Step 1: Rebuilding quiz_question table...");

  sqlite.exec(`
    CREATE TABLE quiz_question_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      deck_id INTEGER,
      quiz_id INTEGER REFERENCES quiz(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      question TEXT NOT NULL,
      explanation TEXT DEFAULT '',
      correct_answer TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (deck_id) REFERENCES deck(id) ON DELETE SET NULL
    )
  `);

  sqlite.exec(`
    INSERT INTO quiz_question_new (id, deck_id, quiz_id, type, question, explanation, correct_answer, created_at)
    SELECT id, deck_id, quiz_id, type, question, explanation, correct_answer, created_at
    FROM quiz_question
  `);

  sqlite.exec("DROP TABLE quiz_question");
  sqlite.exec("ALTER TABLE quiz_question_new RENAME TO quiz_question");

  // Recreate indexes
  sqlite.exec("CREATE INDEX idx_question_deck ON quiz_question (deck_id)");
  sqlite.exec("CREATE INDEX idx_question_quiz ON quiz_question (quiz_id)");
  sqlite.exec("CREATE INDEX idx_question_type ON quiz_question (type)");

  // ── Step 2: Migrate deck quiz questions to standalone quizzes ──────────
  console.log("Step 2: Migrating deck quiz questions to standalone quizzes...");

  // Find all decks that have quiz questions
  const decksWithQuestions = sqlite.prepare(`
    SELECT DISTINCT d.id AS deck_id, d.name, d.description, d.user_id
    FROM deck d
    INNER JOIN quiz_question qq ON qq.deck_id = d.id
    WHERE qq.quiz_id IS NULL
  `).all() as Array<{ deck_id: number; name: string; description: string | null; user_id: number }>;

  const insertQuiz = sqlite.prepare(`
    INSERT INTO quiz (title, description, user_id)
    VALUES (?, ?, ?)
  `);

  const updateQuestions = sqlite.prepare(`
    UPDATE quiz_question SET quiz_id = ? WHERE deck_id = ? AND quiz_id IS NULL
  `);

  // Get courses linked to each deck
  const getLinkedCourses = sqlite.prepare(`
    SELECT course_id, position FROM course_deck WHERE deck_id = ?
  `);

  // Get max step position for a course
  const getMaxStepPosition = sqlite.prepare(`
    SELECT MAX(position) AS max_pos FROM course_step WHERE course_id = ?
  `);

  const insertCourseStep = sqlite.prepare(`
    INSERT INTO course_step (course_id, position, step_type, quiz_id)
    VALUES (?, ?, 'quiz', ?)
  `);

  for (const deck of decksWithQuestions) {
    // Create quiz from deck
    const result = insertQuiz.run(
      `${deck.name} Quiz`,
      deck.description ?? "",
      deck.user_id
    );
    const quizId = Number(result.lastInsertRowid);

    // Link questions to new quiz
    updateQuestions.run(quizId, deck.deck_id);

    // Create course_steps for each course the deck is linked to
    const linkedCourses = getLinkedCourses.all(deck.deck_id) as Array<{ course_id: number; position: number }>;

    for (const link of linkedCourses) {
      // Use the deck's course_deck.position to preserve ordering
      const maxPos = getMaxStepPosition.get(link.course_id) as { max_pos: number | null } | undefined;
      const nextPos = (maxPos?.max_pos ?? -1) + 1;
      insertCourseStep.run(link.course_id, nextPos, quizId);
    }

    console.log(`  Migrated deck "${deck.name}" (id=${deck.deck_id}) → quiz id=${quizId}, linked to ${linkedCourses.length} course(s)`);
  }

  // ── Step 3: Rebuild study_session with three-way CHECK constraint ───────
  // Must happen BEFORE backfilling quiz_id, because the old table has a
  // two-way CHECK (deck_id/course_id only) that rejects quiz-only rows.
  console.log("Step 3: Rebuilding study_session table with CHECK constraint...");

  sqlite.exec(`
    CREATE TABLE study_session_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1,
      deck_id INTEGER,
      course_id INTEGER,
      quiz_id INTEGER,
      mode TEXT NOT NULL,
      sub_mode TEXT,
      started_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      completed_at INTEGER,
      notes TEXT,
      CHECK (
        (deck_id IS NOT NULL AND quiz_id IS NULL AND course_id IS NULL) OR
        (deck_id IS NULL AND quiz_id IS NOT NULL AND course_id IS NULL) OR
        (deck_id IS NULL AND quiz_id IS NULL AND course_id IS NOT NULL)
      ),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
      FOREIGN KEY (deck_id) REFERENCES deck(id) ON DELETE CASCADE ON UPDATE NO ACTION,
      FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE ON UPDATE NO ACTION,
      FOREIGN KEY (quiz_id) REFERENCES quiz(id) ON DELETE SET NULL ON UPDATE NO ACTION
    )
  `);

  sqlite.exec(`
    INSERT INTO study_session_new (id, user_id, deck_id, course_id, quiz_id, mode, sub_mode, started_at, completed_at, notes)
    SELECT id, user_id, deck_id, course_id, quiz_id, mode, sub_mode, started_at, completed_at, notes
    FROM study_session
  `);

  sqlite.exec("DROP TABLE study_session");
  sqlite.exec("ALTER TABLE study_session_new RENAME TO study_session");

  // Recreate indexes
  sqlite.exec("CREATE INDEX idx_study_session_deck ON study_session (deck_id)");
  sqlite.exec("CREATE INDEX idx_study_session_course ON study_session (course_id)");
  sqlite.exec("CREATE INDEX idx_study_session_quiz ON study_session (quiz_id)");
  sqlite.exec("CREATE INDEX idx_study_session_started_at ON study_session (started_at)");
  sqlite.exec("CREATE INDEX idx_study_session_user ON study_session (user_id)");

  // ── Step 4: Backfill study_session.quiz_id ─────────────────────────────
  // Now safe to update rows on the new table which allows quiz-only rows.
  console.log("Step 4: Backfilling study_session.quiz_id...");

  // Map deck_id → quiz_id from quiz_question (migrated quizzes)
  const deckToQuiz = sqlite.prepare(`
    SELECT DISTINCT qq.deck_id, qq.quiz_id
    FROM quiz_question qq
    WHERE qq.deck_id IS NOT NULL AND qq.quiz_id IS NOT NULL
  `).all() as Array<{ deck_id: number; quiz_id: number }>;

  const updateSession = sqlite.prepare(`
    UPDATE study_session
    SET quiz_id = ?, deck_id = NULL
    WHERE deck_id = ? AND mode = 'quiz' AND quiz_id IS NULL
  `);

  for (const mapping of deckToQuiz) {
    const result = updateSession.run(mapping.quiz_id, mapping.deck_id);
    if (result.changes > 0) {
      console.log(`  Backfilled ${result.changes} quiz session(s) for deck ${mapping.deck_id} → quiz ${mapping.quiz_id}`);
    }
  }

  sqlite.exec("COMMIT");
  console.log("Phase 2 migration completed successfully!");

} catch (error) {
  sqlite.exec("ROLLBACK");
  console.error("Migration failed, rolled back:", error);
  process.exit(1);
} finally {
  sqlite.close();
}
