import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type AppDatabase } from "@flashcards/database";
import Database from "better-sqlite3";

/**
 * Sanitize search input for FTS5 MATCH queries.
 * Strips FTS5 special characters and operators, then wraps the entire
 * cleaned input in double quotes as a single phrase.
 */
function sanitizeFtsQuery(query: string): string {
  const cleaned = query.replace(/["\*\(\):<>^]/g, '').replace(/\b(AND|OR|NOT|NEAR)\b/gi, '').trim();
  if (!cleaned) return '""';
  return `"${cleaned}"`;
}

export function registerSearchTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "search_content",
    "Full-text search across flashcards and questions",
    {
      query: z.string().min(1).max(200),
    },
    async ({ query }) => {
      const ftsQuery = sanitizeFtsQuery(query);

      // Access raw sqlite connection for FTS queries
      const sqlite = (db as any).session?.client as Database.Database;

      const flashcardResults = sqlite.prepare(`
        SELECT f.id, f.deck_id, f.front, f.back, 'flashcard' as type
        FROM flashcard_fts
        JOIN flashcard f ON f.id = flashcard_fts.rowid
        JOIN deck d ON f.deck_id = d.id AND d.user_id = ?
        WHERE flashcard_fts MATCH ?
        LIMIT 50
      `).all(userId, ftsQuery);

      const questionResults = sqlite.prepare(`
        SELECT q.id, q.deck_id, q.question, q.type as question_type, 'question' as type
        FROM question_fts
        JOIN quiz_question q ON q.id = question_fts.rowid
        JOIN deck d ON q.deck_id = d.id AND d.user_id = ?
        WHERE question_fts MATCH ?
        LIMIT 50
      `).all(userId, ftsQuery);

      const results = {
        flashcards: flashcardResults,
        questions: questionResults,
        total: flashcardResults.length + questionResults.length,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );
}
