/**
 * Data migration: Move quiz questions from deck-based to quiz-based.
 * Idempotent — safe to run multiple times.
 *
 * Called from docker-migrate.mjs after Drizzle migrations.
 */

/**
 * @param {import("better-sqlite3").Database} sqlite
 */
export function migrateQuestionsToQuizzes(sqlite) {
  // Check if there are any orphan questions (quiz_id IS NULL)
  const orphanCount = sqlite
    .prepare("SELECT COUNT(*) as count FROM quiz_question WHERE quiz_id IS NULL")
    .get();

  if (orphanCount.count === 0) {
    console.log("[quiz-migration] No orphan questions found, skipping.");
    return;
  }

  console.log(
    `[quiz-migration] Found ${orphanCount.count} questions with no quiz_id. Migrating...`
  );

  // Claude Architect deck → quiz mapping (from course journey data)
  const architectMapping = {
    93: 1, 94: 2, 95: 3, 96: 4, 97: 5, 98: 6, 99: 7,
    100: 8, 101: 9, 102: 10, 103: 11, 104: 12,
    105: 13, 106: 14, 107: 15, 108: 17, 109: 23, 110: 24,
    111: 16, 112: 18, 113: 19, 114: 20, 115: 21, 116: 22,
    117: 25, 118: 26, 119: 27, 120: 28, 121: 29, 122: 30,
  };

  sqlite.exec("SAVEPOINT quiz_migration");

  try {
    // Step 1: Link Claude Architect questions to existing quiz entities
    const updateStmt = sqlite.prepare(
      "UPDATE quiz_question SET quiz_id = ? WHERE deck_id = ? AND quiz_id IS NULL"
    );

    for (const [deckId, quizId] of Object.entries(architectMapping)) {
      const result = updateStmt.run(quizId, Number(deckId));
      if (result.changes > 0) {
        console.log(
          `[quiz-migration] Deck ${deckId} → Quiz ${quizId}: ${result.changes} questions`
        );
      }
    }

    // Step 2: For remaining decks, create quiz entities and link
    const decksWithOrphans = sqlite
      .prepare(
        `SELECT DISTINCT d.id, d.name, d.description, d.user_id
         FROM deck d
         JOIN quiz_question qq ON qq.deck_id = d.id
         WHERE qq.quiz_id IS NULL`
      )
      .all();

    const insertQuiz = sqlite.prepare(
      `INSERT INTO quiz (title, description, user_id, created_at, updated_at)
       VALUES (?, ?, ?, unixepoch(), unixepoch())`
    );
    const linkQuestions = sqlite.prepare(
      "UPDATE quiz_question SET quiz_id = ? WHERE deck_id = ? AND quiz_id IS NULL"
    );
    const getMaterialDecks = sqlite.prepare(
      "SELECT material_id FROM material_deck WHERE deck_id = ?"
    );
    const insertMaterialQuiz = sqlite.prepare(
      "INSERT OR IGNORE INTO material_quiz (material_id, quiz_id) VALUES (?, ?)"
    );

    for (const deck of decksWithOrphans) {
      const quizResult = insertQuiz.run(
        deck.name,
        deck.description || "",
        deck.user_id
      );
      const quizId = quizResult.lastInsertRowid;
      const linked = linkQuestions.run(quizId, deck.id);
      console.log(
        `[quiz-migration] Deck ${deck.id} ("${deck.name}") → New Quiz ${quizId}: ${linked.changes} questions`
      );

      // Copy material links
      const materialLinks = getMaterialDecks.all(deck.id);
      for (const ml of materialLinks) {
        insertMaterialQuiz.run(ml.material_id, quizId);
      }
    }

    // Verify
    const remaining = sqlite
      .prepare("SELECT COUNT(*) as count FROM quiz_question WHERE quiz_id IS NULL")
      .get();

    if (remaining.count > 0) {
      throw new Error(
        `${remaining.count} questions still have no quiz_id after migration`
      );
    }

    sqlite.exec("RELEASE quiz_migration");
    console.log("[quiz-migration] Migration completed successfully.");
  } catch (error) {
    sqlite.exec("ROLLBACK TO quiz_migration");
    console.error("[quiz-migration] Migration failed, rolled back:", error);
    throw error;
  }
}
