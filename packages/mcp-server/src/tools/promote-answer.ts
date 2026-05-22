import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sql, eq, and } from "drizzle-orm";
import { flashcards, decks, writeTransaction, type AppDatabase } from "@flashcards/database";

export interface PromoteInput {
  answerId: number;
  deckId: number;
  front?: string;
  back?: string;
}

export function promoteAnswerToFlashcard(db: AppDatabase, userId: number, input: PromoteInput) {
  const owned = db.get<{ question_id: number; explanation: string | null; question_text: string; correct_option_text: string | null }>(sql`
    SELECT qr.question_id AS question_id,
           qq.explanation AS explanation,
           qq.question AS question_text,
           (SELECT option_text FROM question_option WHERE question_id = qq.id AND is_correct = 1 LIMIT 1) AS correct_option_text
    FROM quiz_result qr
    INNER JOIN quiz_question qq ON qq.id = qr.question_id
    INNER JOIN quiz q ON q.id = qq.quiz_id
    WHERE qr.id = ${input.answerId} AND q.user_id = ${userId}
  `);
  if (!owned) throw new Error("Answer not found");

  const deck = db.select({ id: decks.id }).from(decks)
    .where(and(eq(decks.id, input.deckId), eq(decks.userId, userId))).get();
  if (!deck) throw new Error("Deck not found");

  const front = input.front ?? owned.question_text;
  const back = input.back ?? (owned.explanation && owned.explanation.length > 0 ? owned.explanation : (owned.correct_option_text ?? ""));

  return writeTransaction(db, () =>
    db.insert(flashcards).values({ deckId: input.deckId, front, back }).returning().get()
  );
}

export function registerPromoteAnswerTools(server: McpServer, db: AppDatabase, userId: number) {
  server.tool(
    "promote_answer_to_flashcard",
    "Create a flashcard from a quiz answer. Defaults: front=question text, back=explanation or correct option text.",
    {
      answerId: z.number().int().positive(),
      deckId: z.number().int().positive(),
      front: z.string().optional(),
      back: z.string().optional(),
    },
    async (input) => {
      try {
        const card = promoteAnswerToFlashcard(db, userId, input);
        return { content: [{ type: "text" as const, text: JSON.stringify(card, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: (e as Error).message }], isError: true };
      }
    }
  );
}
