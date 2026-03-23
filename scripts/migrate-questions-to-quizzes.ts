/**
 * Migration script: Move all quiz questions from deck-based to quiz-based.
 *
 * Old model: quiz_question has deckId (required) + quizId (optional)
 * New model: quiz_question has quizId (required) + deckId removed
 *
 * Steps:
 * 1. For Claude Architect decks (93-122): link to existing quiz entities (1-30)
 * 2. For FAANG/AI-ML decks: create quiz entities, then link questions
 * 3. Null out deckId on all quiz_question rows
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function findMonorepoRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const DB_PATH =
  process.env.DATABASE_PATH ||
  path.join(findMonorepoRoot(), "data", "flashcards.db");

console.log(`Using database: ${DB_PATH}`);

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = OFF"); // Disable during migration

// --- Claude Architect deck→quiz mapping (from course journey data) ---
const architectMapping: Record<number, number> = {
  // D1
  93: 1, 94: 2, 95: 3, 96: 4, 97: 5, 98: 6, 99: 7,
  // D2
  100: 8, 101: 9, 102: 10, 103: 11, 104: 12,
  // D3
  105: 13, 106: 14, 107: 15, 108: 17, 109: 23, 110: 24,
  // D4
  111: 16, 112: 18, 113: 19, 114: 20, 115: 21, 116: 22,
  // D5
  117: 25, 118: 26, 119: 27, 120: 28, 121: 29, 122: 30,
};

const architectDeckIds = new Set(Object.keys(architectMapping).map(Number));

// Start a transaction
sqlite.exec("BEGIN");

try {
  // Step 1: Link Claude Architect questions to existing quiz entities
  console.log("\n--- Step 1: Linking Claude Architect questions ---");
  const updateStmt = sqlite.prepare(
    "UPDATE quiz_question SET quiz_id = ? WHERE deck_id = ? AND quiz_id IS NULL"
  );

  for (const [deckId, quizId] of Object.entries(architectMapping)) {
    const result = updateStmt.run(quizId, Number(deckId));
    if (result.changes > 0) {
      console.log(`  Deck ${deckId} → Quiz ${quizId}: ${result.changes} questions linked`);
    }
  }

  // Step 2: Find non-architect decks that have questions without quiz entities
  console.log("\n--- Step 2: Creating quiz entities for other decks ---");
  const decksWithOrphanQuestions = sqlite
    .prepare(
      `SELECT DISTINCT d.id, d.name, d.description, d.user_id
       FROM deck d
       JOIN quiz_question qq ON qq.deck_id = d.id
       WHERE qq.quiz_id IS NULL`
    )
    .all() as { id: number; name: string; description: string; user_id: number }[];

  const insertQuiz = sqlite.prepare(
    `INSERT INTO quiz (title, description, user_id, created_at, updated_at)
     VALUES (?, ?, ?, unixepoch(), unixepoch())`
  );

  const linkQuestions = sqlite.prepare(
    "UPDATE quiz_question SET quiz_id = ? WHERE deck_id = ? AND quiz_id IS NULL"
  );

  // Also link quiz to material if deck is linked
  const getMaterialDecks = sqlite.prepare(
    "SELECT material_id FROM material_deck WHERE deck_id = ?"
  );
  const insertMaterialQuiz = sqlite.prepare(
    "INSERT OR IGNORE INTO material_quiz (material_id, quiz_id) VALUES (?, ?)"
  );

  for (const deck of decksWithOrphanQuestions) {
    // Create quiz entity
    const quizResult = insertQuiz.run(
      deck.name,
      deck.description || "",
      deck.user_id
    );
    const quizId = quizResult.lastInsertRowid as number;

    // Link questions
    const linked = linkQuestions.run(quizId, deck.id);
    console.log(
      `  Deck ${deck.id} ("${deck.name}") → New Quiz ${quizId}: ${linked.changes} questions linked`
    );

    // Copy material links from material_deck to material_quiz
    const materialLinks = getMaterialDecks.all(deck.id) as { material_id: number }[];
    for (const ml of materialLinks) {
      insertMaterialQuiz.run(ml.material_id, quizId);
    }
  }

  // Step 3: Verify no orphan questions remain
  console.log("\n--- Step 3: Verification ---");
  const orphanCount = sqlite
    .prepare("SELECT COUNT(*) as count FROM quiz_question WHERE quiz_id IS NULL")
    .get() as { count: number };

  if (orphanCount.count > 0) {
    console.error(`ERROR: ${orphanCount.count} questions still have no quiz_id!`);
    throw new Error("Migration incomplete - orphan questions remain");
  }

  const totalQuestions = sqlite
    .prepare("SELECT COUNT(*) as count FROM quiz_question")
    .get() as { count: number };
  const totalQuizzes = sqlite
    .prepare("SELECT COUNT(*) as count FROM quiz")
    .get() as { count: number };

  console.log(`  Total questions: ${totalQuestions.count} (all linked to quizzes)`);
  console.log(`  Total quiz entities: ${totalQuizzes.count}`);

  sqlite.exec("COMMIT");
  console.log("\nMigration completed successfully!");
} catch (error) {
  sqlite.exec("ROLLBACK");
  console.error("\nMigration failed, rolled back:", error);
  process.exit(1);
} finally {
  sqlite.pragma("foreign_keys = ON");
  sqlite.close();
}
